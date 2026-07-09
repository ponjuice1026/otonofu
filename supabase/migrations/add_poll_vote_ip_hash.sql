-- 投票のcookie依存を緩和（IPハッシュ併用）（監査 B-3）
-- Supabase Dashboard → SQL Editor で実行
--
-- 前提（適用順）:
--   1. update_moderation_rpc.sql （vote_discussion_poll + BAN チェック、最新版）
--   2. add_thread_lock.sql       （vote_discussion_poll + 凍結チェック）
--   3. このファイル
--
-- 背景:
--   discussion_poll_votes は unique(thread_id, voter_key) のみで重複投票を
--   防いでいる。voter_key は httpOnly cookie 由来のため、cookie を消せば
--   （シークレットウィンドウ等でも）再投票できてしまう。
--
-- 対応（完全防止ではなく「緩和」。匿名投票の性質上、完全ななりすまし防止は
--   不可能なため、同一ネットワークからの多重投票をある程度抑止する程度に
--   とどめる。IP 共有環境（NAT・モバイル回線・学校/企業ネットワーク）では
--   同一 IP の別人が誤って「投票済み」判定されうるが、ポイント制度ではなく
--   単純な世論調査的機能であるため許容する）:
--   - discussion_poll_votes に ip_hash 列を追加（既存行は null 許容）。
--   - (thread_id, ip_hash) の部分ユニークインデックス（ip_hash が null で
--     ない行のみ対象）で、同一スレ・同一IPハッシュからの二重投票を防ぐ。
--   - 生 IP は保存しない。sha256(salt + ip) のハッシュのみを保存する
--     （proxy.ts の viewer_hash / lib/threads/thread-id.ts と同じ方針）。
--   - vote_discussion_poll に引数 target_ip_hash を追加（末尾 default null
--     で後方互換。呼び出し側を更新しなくても既存呼び出しは動く）。

-- ---------------------------------------------------------------------------
-- カラム追加 + 部分ユニークインデックス
-- ---------------------------------------------------------------------------
alter table public.discussion_poll_votes
  add column if not exists ip_hash text;

create unique index if not exists discussion_poll_votes_thread_ip_hash_idx
  on public.discussion_poll_votes (thread_id, ip_hash)
  where ip_hash is not null;

-- ---------------------------------------------------------------------------
-- vote_discussion_poll（+ BAN チェック + 凍結チェック + IPハッシュ併用）
--   add_thread_lock.sql の版をベースに、末尾に target_ip_hash を追加し、
--   挿入時に ip_hash も入れる。他のロジックは一切変更しない。
--   (thread_id, ip_hash) の部分ユニーク制約違反は 23505 として返る。
--   voter_key 由来の 23505 と区別せず、アプリ側で同一メッセージにまとめる。
-- ---------------------------------------------------------------------------
create or replace function public.vote_discussion_poll(
  target_thread_id uuid,
  target_option_id uuid,
  voter_key text,
  target_ip_hash text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  limit_key text;
  new_id uuid;
  thread_locked_at timestamptz;
  normalized_ip_hash text;
begin
  if voter_key is null or char_length(trim(voter_key)) < 16 then
    raise exception 'invalid voter key';
  end if;

  -- BAN チェック
  if public.otonofu_is_banned(auth.uid(), voter_key) then
    raise exception 'banned';
  end if;

  select t.locked_at into thread_locked_at
  from public.discussion_threads t
  where t.id = target_thread_id;

  if not found then
    raise exception 'thread not found';
  end if;

  -- スレが凍結されていれば投票も拒否（D-3）。
  if thread_locked_at is not null then
    raise exception 'thread locked';
  end if;

  limit_key := public.otonofu_rate_limit_key(voter_key);

  -- 選択肢がスレッドに属することを確認
  if not exists (
    select 1 from public.discussion_poll_options
    where id = target_option_id and thread_id = target_thread_id
  ) then
    raise exception 'option not found';
  end if;

  -- レート制限（reaction: 30/分）。
  if not public.check_rate_limit(
    limit_key, 'reaction', 30, 60, null, 60
  ) then
    raise exception 'rate limit exceeded';
  end if;

  -- ip_hash は最低限の長さチェックのみ（sha256 hex なら64桁だが、
  -- 将来の実装変更に備えて厳密な桁数は強制しない）。
  normalized_ip_hash := nullif(trim(coalesce(target_ip_hash, '')), '');
  if normalized_ip_hash is not null and char_length(normalized_ip_hash) < 8 then
    normalized_ip_hash := null;
  end if;

  -- 一意制約(thread_id, voter_key)により二重投票は 23505 で弾かれる。
  -- 部分ユニーク(thread_id, ip_hash)によりIP単位でも同様に弾かれる。
  insert into public.discussion_poll_votes (thread_id, option_id, voter_key, ip_hash)
  values (target_thread_id, target_option_id, voter_key, normalized_ip_hash)
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.vote_discussion_poll(uuid, uuid, text, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 旧シグネチャ（3引数版）を drop する。
--   PostgreSQL は引数の数が異なる関数を別オーバーロードとして扱うため、
--   4引数版を create or replace しても3引数版は残ったままになり、
--   default 引数付きの4引数版と曖昧になる可能性がある（例: PostgREST が
--   3引数の POST 呼び出しを受けたときにどちらを使うか不定になりうる）。
--   呼び出し側（app/threads/actions.ts）は4引数版に統一するため、
--   3引数版は明示的に削除する。
-- ---------------------------------------------------------------------------
drop function if exists public.vote_discussion_poll(uuid, uuid, text);
