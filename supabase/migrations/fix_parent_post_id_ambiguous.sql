-- 修正: create_discussion_post 内の parent_post_id 曖昧参照
-- 原因: add_post_replies.sql で discussion_posts に parent_post_id 列を追加した後、
--       関数引数 parent_post_id と列 parent_post_id が同名で曖昧(ambiguous)になった。
-- 対応: #variable_conflict use_variable を付け、曖昧な名前は変数(引数)側に解決させる。
--       シグネチャは不変なのでアプリ側の呼び出しは変更不要。
-- Supabase Dashboard → SQL Editor で実行。

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
    auth.uid(), coalesce(post_is_anonymous, false), post_thread_local_id
  )
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.create_discussion_post(
  uuid, text, text, text, uuid, text, boolean, text
) to anon, authenticated;
