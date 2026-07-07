-- 匿名投稿系の「DB 直叩きバイパス」を塞ぐ（A-2）
-- Supabase Dashboard → SQL Editor で実行
--
-- 背景（脆弱性）:
--   discussion_posts / review_comments / discussion_poll_votes の insert ポリシーが
--   with check (true) だったため、公開 anon キーで PostgREST を直接叩けば
--   アプリ層のレート制限(lib/rate-limit.ts)とモデレーション(lib/moderation.ts)を
--   完全に迂回して無制限に書き込めた。
--
-- 対策:
--   各テーブルへの insert を security definer 関数(RPC)経由に限定する。
--   RPC 内で既存の check_rate_limit() を呼び、上限超過なら日本語識別可能な
--   例外を投げてから挿入する。key は auth.uid() または voter_key。
--   併せて最低限のモデレーション(URL 数上限)を SQL 側にも入れる（多層防御）。
--   従来の permissive な insert ポリシーは drop し、select ポリシーは残す。
--
-- 注意: アプリ側(Server Actions)は従来のアプリ層チェックを残したまま
--   .insert() を各 RPC 呼び出しに置き換える。RPC は挿入行の id を返す
--   （挿入後の通知処理などが inserted id を必要とするため）。

-- ---------------------------------------------------------------------------
-- 共通: レート制限キーの組み立てとモデレーション（URL 数上限）
-- ---------------------------------------------------------------------------

-- アプリ層(lib/rate-limit.ts)と同じキー体系:
--   ログインユーザー -> 'user:<uid>'、匿名 -> 'voter:<voter_key>'
-- これによりアプリ層と DB 層でレート制限のカウントが共有される。
create or replace function public.otonofu_rate_limit_key(voter_key text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    return 'user:' || auth.uid()::text;
  end if;
  if voter_key is null or char_length(trim(voter_key)) < 16 then
    return null;
  end if;
  return 'voter:' || voter_key;
end;
$$;

-- 本文中の URL 数が上限(5)を超えていれば例外を投げる。
-- lib/moderation.ts の MAX_URL_COUNT と揃える（完全移植ではなく最低限の防御）。
create or replace function public.otonofu_assert_content_ok(body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  url_count integer;
begin
  url_count := coalesce(regexp_count(coalesce(body, ''), 'https?://', 1, 'i'), 0);
  if url_count > 5 then
    raise exception 'moderation: too many urls';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- discussion_posts への挿入 RPC
-- ---------------------------------------------------------------------------
create or replace function public.create_discussion_post(
  target_thread_id uuid,
  post_body text,
  post_anonymous_name text,
  voter_key text,
  parent_post_id uuid default null,
  dedup_body text default null
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

  insert into public.discussion_posts (thread_id, anonymous_name, body, parent_post_id)
  values (target_thread_id, normalized_name, normalized_body, parent_post_id)
  returning id into new_id;

  return new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- review_comments への挿入 RPC
-- ---------------------------------------------------------------------------
create or replace function public.create_review_comment(
  target_review_id text,
  comment_body text,
  comment_anonymous_name text,
  voter_key text,
  parent_comment_id uuid default null,
  dedup_body text default null
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

  normalized_body := coalesce(comment_body, '');
  if char_length(trim(normalized_body)) < 1 or char_length(trim(normalized_body)) > 2000 then
    raise exception 'invalid comment body';
  end if;

  normalized_name := coalesce(comment_anonymous_name, '');
  if char_length(trim(normalized_name)) < 1 or char_length(trim(normalized_name)) > 24 then
    raise exception 'invalid anonymous name';
  end if;

  if not exists (
    select 1 from public.reviews where id = target_review_id
  ) then
    raise exception 'review not found';
  end if;

  if parent_comment_id is not null and not exists (
    select 1 from public.review_comments
    where id = parent_comment_id and review_id = target_review_id
  ) then
    raise exception 'parent comment not found';
  end if;

  perform public.otonofu_assert_content_ok(normalized_body);

  -- レート制限（review_comment: 5/時）。
  if not public.check_rate_limit(
    limit_key, 'review_comment', 5, 3600, dedup_body, 60
  ) then
    raise exception 'rate limit exceeded';
  end if;

  insert into public.review_comments (review_id, author_id, anonymous_name, body, parent_comment_id)
  values (
    target_review_id,
    auth.uid(),
    normalized_name,
    normalized_body,
    parent_comment_id
  )
  returning id into new_id;

  return new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- discussion_poll_votes への挿入 RPC
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
begin
  if voter_key is null or char_length(trim(voter_key)) < 16 then
    raise exception 'invalid voter key';
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

-- ---------------------------------------------------------------------------
-- 旧 permissive insert ポリシーを drop（select ポリシーは残す）
-- ---------------------------------------------------------------------------
-- discussion_posts: add_discussion_threads.sql の "anyone can post anonymously"
drop policy if exists "anyone can post anonymously" on public.discussion_posts;

-- review_comments: add_review_comments.sql の "anyone can comment on reviews"
drop policy if exists "anyone can comment on reviews" on public.review_comments;

-- discussion_poll_votes: add_discussion_polls.sql の "anyone can vote once per thread"
drop policy if exists "anyone can vote once per thread" on public.discussion_poll_votes;

-- ---------------------------------------------------------------------------
-- 実行権限。挿入は RPC 経由のみ許可し、テーブルへの直接 insert は
-- ポリシー削除により拒否される（RLS 有効・insert ポリシー無し）。
-- ---------------------------------------------------------------------------
grant execute on function public.create_discussion_post(uuid, text, text, text, uuid, text)
  to anon, authenticated;
grant execute on function public.create_review_comment(text, text, text, text, uuid, text)
  to anon, authenticated;
grant execute on function public.vote_discussion_poll(uuid, uuid, text)
  to anon, authenticated;
-- ヘルパは RPC 内部からのみ呼ばれるが、明示 grant は不要（definer 実行）。
