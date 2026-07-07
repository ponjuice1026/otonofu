-- create_discussion_post RPC を更新し、投稿者識別カラムを挿入時に埋める
-- Supabase Dashboard → SQL Editor で実行
--
-- 前提: add_post_author_id.sql を先に適用していること
--       （author_id / is_anonymous / thread_local_id カラムが存在する）。
--
-- 変更点（enforce_insert_rpc.sql の同名関数を create or replace）:
--   - author_id := auth.uid() を挿入時にセットする。
--     security definer 関数だが auth.uid() は「RPC を呼び出したユーザー」を返すため、
--     クライアントが任意の author_id を詐称することは不可能（最も安全な方式）。
--     ログインユーザーは匿名表示を選んでいても author_id が保存される（内部用途）。
--   - is_anonymous / thread_local_id を引数で受け取り保存する。
--     thread_local_id はサーバー側で計算済みのハッシュ結果のみ（生 key は渡さない）。
--
-- 既存の引数（target_thread_id ... dedup_body）は互換のため順序を維持し、
-- 新引数を末尾に default 付きで追加する。旧シグネチャの呼び出しがあっても
-- default により壊れない。

create or replace function public.create_discussion_post(
  target_thread_id uuid,
  post_body text,
  post_anonymous_name text,
  voter_key text,
  parent_post_id uuid default null,
  dedup_body text default null,
  post_is_anonymous boolean default false,
  post_thread_local_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  limit_key text;
  normalized_body text;
  normalized_name text;
  new_id uuid;
begin
  limit_key := public.otonofu_rate_limit_key(voter_key);

  normalized_body := coalesce(post_body, '');
  if char_length(trim(normalized_body)) < 1 or char_length(trim(normalized_body)) > 4000 then
    raise exception 'invalid post body';
  end if;

  normalized_name := coalesce(post_anonymous_name, '');
  if char_length(trim(normalized_name)) < 1 or char_length(trim(normalized_name)) > 24 then
    raise exception 'invalid anonymous name';
  end if;

  if not exists (
    select 1 from public.discussion_threads where id = target_thread_id
  ) then
    raise exception 'thread not found';
  end if;

  if parent_post_id is not null and not exists (
    select 1 from public.discussion_posts
    where id = parent_post_id and thread_id = target_thread_id
  ) then
    raise exception 'parent post not found';
  end if;

  -- 最低限のモデレーション（URL 数上限）
  perform public.otonofu_assert_content_ok(normalized_body);

  -- レート制限（post_create: 10/分）。上限超過なら例外。
  if not public.check_rate_limit(
    limit_key, 'post_create', 10, 60, dedup_body, 60
  ) then
    raise exception 'rate limit exceeded';
  end if;

  insert into public.discussion_posts (
    thread_id, anonymous_name, body, parent_post_id,
    author_id, is_anonymous, thread_local_id
  )
  values (
    target_thread_id, normalized_name, normalized_body, parent_post_id,
    -- security definer でも auth.uid() は呼び出しユーザー本人。詐称不可。
    auth.uid(), coalesce(post_is_anonymous, false), post_thread_local_id
  )
  returning id into new_id;

  return new_id;
end;
$$;

-- 新シグネチャに対する実行権限。
grant execute on function public.create_discussion_post(
  uuid, text, text, text, uuid, text, boolean, text
) to anon, authenticated;
