-- モデレーション強制の DB 側統合（NG ワード + BAN）
-- Supabase Dashboard → SQL Editor で実行
--
-- 前提（適用順）:
--   1. enforce_insert_rpc.sql            （挿入 RPC の初版）
--   2. add_post_author_id.sql            （author_id / is_anonymous / thread_local_id カラム）
--   3. update_create_discussion_post_author.sql （create_discussion_post 8引数版）
--   4. add_moderation_words.sql          （banned_words テーブル）
--   5. add_user_bans.sql                 （user_bans テーブル + otonofu_is_banned）
--   6. このファイル
--
-- 変更点:
--   - otonofu_assert_content_ok(body) を拡張し、banned_words テーブルを参照して
--     NG ワードを含む本文で例外 'moderation: banned word' を投げる。
--     is_regex=true は body ~* pattern、通常は position(pattern in body) で判定。
--     既存の URL 数上限チェックはそのまま残す。
--   - 各挿入 RPC の冒頭で otonofu_is_banned(auth.uid(), voter_key) を呼び、
--     true なら例外 'banned' を投げる。
--   - create_discussion_post は update_create_discussion_post_author.sql の
--     8 引数版をベースに create or replace（author_id/is_anonymous/thread_local_id の
--     挿入を維持）。引数は増やさず、冒頭に BAN チェックを足すだけ。
--
-- 注意: 例外文言は既存 mapInsertRpcError の分岐で拾える英語を維持する。

-- ---------------------------------------------------------------------------
-- 本文モデレーション: URL 数上限 + NG ワード照合
-- ---------------------------------------------------------------------------
create or replace function public.otonofu_assert_content_ok(body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  url_count integer;
  normalized text;
begin
  normalized := coalesce(body, '');

  -- URL の貼り付けすぎ（既存の防御を維持）
  url_count := coalesce(regexp_count(normalized, 'https?://', 1, 'i'), 0);
  if url_count > 5 then
    raise exception 'moderation: too many urls';
  end if;

  -- DB の NG ワード照合（多層防御）。
  -- 通常語は大文字小文字を無視した部分一致(ilike)、is_regex は body ~* pattern。
  if exists (
    select 1
    from public.banned_words w
    where (
      (w.is_regex is true and normalized ~* w.pattern)
      or (coalesce(w.is_regex, false) is false and normalized ilike '%' || w.pattern || '%')
    )
  ) then
    raise exception 'moderation: banned word';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- discussion_posts への挿入 RPC（8引数版 + BAN チェック）
--   update_create_discussion_post_author.sql をベースに、冒頭で BAN 判定を追加。
--   author_id / is_anonymous / thread_local_id の挿入は維持（Phase2 を壊さない）。
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
-- review_comments への挿入 RPC（+ BAN チェック）
--   enforce_insert_rpc.sql の同名関数をベースに、冒頭で BAN 判定を追加。
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
  -- BAN チェック
  if public.otonofu_is_banned(auth.uid(), voter_key) then
    raise exception 'banned';
  end if;

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

  -- モデレーション（URL 数上限 + NG ワード）
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

grant execute on function public.create_review_comment(text, text, text, text, uuid, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- discussion_poll_votes への挿入 RPC（+ BAN チェック）
--   enforce_insert_rpc.sql の同名関数をベースに、冒頭で BAN 判定を追加。
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

  -- BAN チェック
  if public.otonofu_is_banned(auth.uid(), voter_key) then
    raise exception 'banned';
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
