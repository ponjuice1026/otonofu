-- discussion_posts に投稿者識別のためのカラムを追加する（構造欠陥の解消）
-- Supabase Dashboard → SQL Editor で実行
--
-- 背景:
--   discussion_posts には投稿者IDが無く、以下が実現できなかった:
--     - 自分のレスの自己削除
--     - 返信先投稿者への通知
--     - ユーザーページの発言履歴
--     - BAN 等の投稿者紐付け
--
-- 方針（匿名性を最優先）:
--   - author_id: ログインユーザーの投稿は「匿名表示を選んでいても」内部保存する。
--     UI で実名を出す用途には使わない（自己削除・通知・BAN・履歴の内部判定のみ）。
--   - is_anonymous: 匿名表示で投稿したか。公開履歴を非匿名レスに限定するために使う。
--   - thread_local_id: 5ch 式のスレ内ID（日付JSTで変わる短いハッシュ）。生 key は保存しない。
--   既存レスはすべて null / false のまま（バックフィルしない）。

-- ---------------------------------------------------------------------------
-- カラム追加
-- ---------------------------------------------------------------------------
alter table public.discussion_posts
  add column if not exists author_id uuid
    references auth.users (id) on delete set null;

-- 匿名表示で投稿したかどうか。既定は false（非匿名）。
-- 公開ユーザーページの発言履歴は is_anonymous = false に限定する。
alter table public.discussion_posts
  add column if not exists is_anonymous boolean not null default false;

-- 5ch 式スレ内ID。サーバー側で計算したハッシュ結果のみを保存する。
alter table public.discussion_posts
  add column if not exists thread_local_id text;

-- ---------------------------------------------------------------------------
-- インデックス
-- ---------------------------------------------------------------------------
-- 発言履歴の取得（author_id で新しい順）
create index if not exists discussion_posts_author_idx
  on public.discussion_posts (author_id, created_at desc)
  where author_id is not null;

-- ---------------------------------------------------------------------------
-- RLS: 自分のレスの削除を許可（管理者用 "admins can delete any post" は既存）
-- ---------------------------------------------------------------------------
-- author_id が入っている（=ログインして投稿した）レスに限り、本人が削除可能。
-- 匿名表示レスでも author_id は入っているため、本人による自己削除は可能。
drop policy if exists "authors can delete own posts" on public.discussion_posts;
create policy "authors can delete own posts"
  on public.discussion_posts for delete
  using (author_id is not null and auth.uid() = author_id);
