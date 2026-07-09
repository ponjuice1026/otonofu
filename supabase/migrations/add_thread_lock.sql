-- スレ凍結（管理者がロックし新規投稿・投票を止める）（監査 D-3）
-- Supabase Dashboard → SQL Editor で実行
--
-- 前提（適用順）:
--   1. update_moderation_rpc.sql （create_discussion_post 8引数版 + BAN チェック
--      / vote_discussion_poll + BAN チェック、最新版）
--   2. add_admin_role.sql        （current_user_is_admin()）
--   3. このファイル
--
-- 変更点:
--   - discussion_threads に locked_at / locked_by / lock_reason を追加。
--     locked_at が null なら非凍結、値があれば凍結中。
--   - 凍結・解除は管理者のみ（RLS 側は add_admin_role.sql の
--     "admins can update any thread" で update 自体は許可済み。ここでは
--     アプリ側 Server Action で isCurrentUserAdmin() を確認する前提。
--     念のため update 用ポリシーが存在しない場合に備えて再定義もしておく）。
--   - create_discussion_post / vote_discussion_poll を create or replace し、
--     対象スレが凍結中なら例外 'thread locked' を投げる。
--     update_moderation_rpc.sql の全ロジック（BAN チェック・NGワード・
--     author_id/is_anonymous/thread_local_id・レート制限）は完全に維持し、
--     冒頭に凍結チェックの1行を足すだけ。
--
-- 注意: 例外文言 'thread locked' は app/threads/actions.ts の
--   mapInsertRpcError で日本語にマップする。

-- ---------------------------------------------------------------------------
-- カラム追加
-- ---------------------------------------------------------------------------
alter table public.discussion_threads
  add column if not exists locked_at timestamptz;

alter table public.discussion_threads
  add column if not exists locked_by uuid references auth.users (id) on delete set null;

alter table public.discussion_threads
  add column if not exists lock_reason text check (char_length(lock_reason) <= 200);

create index if not exists discussion_threads_locked_idx
  on public.discussion_threads (locked_at)
  where locked_at is not null;

-- ---------------------------------------------------------------------------
-- 管理者による update を許可するポリシーが無い環境向けの保険。
-- add_admin_role.sql で既に定義済みなら同名 drop → create で置き換えられる
-- だけで実質的な変更は無い。
-- ---------------------------------------------------------------------------
drop policy if exists "admins can update any thread" on public.discussion_threads;
create policy "admins can update any thread"
  on public.discussion_threads for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- ---------------------------------------------------------------------------
-- create_discussion_post（8引数版 + BAN チェック + 凍結チェック）
--   update_moderation_rpc.sql をベースに、スレ存在チェックの直後で
--   凍結判定を追加する。他のロジックは一切変更しない。
-- ---------------------------------------------------------------------------
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
#variable_conflict use_variable
declare
  limit_key text;
  normalized_body text;
  normalized_name text;
  new_id uuid;
  thread_locked_at timestamptz;
begin
  -- BAN チェック（ログイン uid / 匿名 voter_key のいずれかが BAN なら拒否）
  if public.otonofu_is_banned(auth.uid(), voter_key) then
    raise exception 'banned';
  end if;

  limit_key := public.otonofu_rate_limit_key(voter_key);

  normalized_body := coalesce(post_body, '');
  if char_length(trim(normalized_body)) < 1 or char_length(trim(normalized_body)) > 4000 then
    raise exception 'invalid post body';
  end if;

  normalized_name := coalesce(post_anonymous_name, '');
  if char_length(trim(normalized_name)) < 1 or char_length(trim(normalized_name)) > 24 then
    raise exception 'invalid anonymous name';
  end if;

  select t.locked_at into thread_locked_at
  from public.discussion_threads t
  where t.id = target_thread_id;

  if not found then
    raise exception 'thread not found';
  end if;

  -- スレが凍結されていれば新規投稿を拒否（D-3）。
  if thread_locked_at is not null then
    raise exception 'thread locked';
  end if;

  if parent_post_id is not null and not exists (
    select 1 from public.discussion_posts
    where id = parent_post_id and thread_id = target_thread_id
  ) then
    raise exception 'parent post not found';
  end if;

  -- モデレーション（URL 数上限 + NG ワード）
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

grant execute on function public.create_discussion_post(
  uuid, text, text, text, uuid, text, boolean, text
) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- vote_discussion_poll（+ BAN チェック + 凍結チェック）
--   update_moderation_rpc.sql をベースに、選択肢存在チェックの前後で
--   凍結判定を追加する（任意だが望ましいとの指示のため実装）。
-- ---------------------------------------------------------------------------
create or replace function public.vote_discussion_poll(
  target_thread_id uuid,
  target_option_id uuid,
  voter_key text
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

  -- スレが凍結されていれば投票も拒否（D-3、任意だが望ましい）。
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

  -- 一意制約(thread_id, voter_key)により二重投票は 23505 で弾かれる。
  insert into public.discussion_poll_votes (thread_id, option_id, voter_key)
  values (target_thread_id, target_option_id, voter_key)
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.vote_discussion_poll(uuid, uuid, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- スレ凍結・解除 RPC（管理者専用）。
--   アプリ側 Server Action でも isCurrentUserAdmin() を確認するが、
--   DB 側でも current_user_is_admin() を強制する（多層防御）。
-- ---------------------------------------------------------------------------
create or replace function public.lock_discussion_thread(
  target_thread_id uuid,
  reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_reason text;
begin
  if not public.current_user_is_admin() then
    raise exception 'admin required';
  end if;

  if not exists (
    select 1 from public.discussion_threads where id = target_thread_id
  ) then
    raise exception 'thread not found';
  end if;

  normalized_reason := nullif(trim(coalesce(reason, '')), '');
  if normalized_reason is not null and char_length(normalized_reason) > 200 then
    raise exception 'invalid lock reason';
  end if;

  update public.discussion_threads
  set locked_at = now(),
      locked_by = auth.uid(),
      lock_reason = normalized_reason
  where id = target_thread_id;
end;
$$;

grant execute on function public.lock_discussion_thread(uuid, text)
  to authenticated;

create or replace function public.unlock_discussion_thread(
  target_thread_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'admin required';
  end if;

  if not exists (
    select 1 from public.discussion_threads where id = target_thread_id
  ) then
    raise exception 'thread not found';
  end if;

  update public.discussion_threads
  set locked_at = null,
      locked_by = null,
      lock_reason = null
  where id = target_thread_id;
end;
$$;

grant execute on function public.unlock_discussion_thread(uuid)
  to authenticated;
