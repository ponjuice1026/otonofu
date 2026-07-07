-- スレッド（セッション）の固定カテゴリ（板）
-- Supabase Dashboard → SQL Editor で実行
-- add_discussion_threads.sql / add_admin_role.sql の後に適用すること。

-- 固定カテゴリはテーブルで保持する（enum にしない = 後から SQL で追加可能）。
create table if not exists public.discussion_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (char_length(trim(slug)) between 1 and 40),
  name text not null check (char_length(trim(name)) between 1 and 40),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists discussion_categories_position_idx
  on public.discussion_categories (position asc, created_at asc);

alter table public.discussion_categories enable row level security;

-- 閲覧は全員可。作成・更新・削除は管理者のみ（add_content_reports.sql の管理者ポリシーに準拠）。
drop policy if exists "discussion_categories are viewable by everyone"
  on public.discussion_categories;
create policy "discussion_categories are viewable by everyone"
  on public.discussion_categories for select using (true);

drop policy if exists "admins can insert categories" on public.discussion_categories;
create policy "admins can insert categories"
  on public.discussion_categories for insert
  with check (public.current_user_is_admin());

drop policy if exists "admins can update categories" on public.discussion_categories;
create policy "admins can update categories"
  on public.discussion_categories for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

drop policy if exists "admins can delete categories" on public.discussion_categories;
create policy "admins can delete categories"
  on public.discussion_categories for delete
  using (public.current_user_is_admin());

-- 初期カテゴリ。slug 衝突時は何もしない（再実行しても安全）。
insert into public.discussion_categories (slug, name, position) values
  ('hougaku', '邦楽', 10),
  ('yougaku', '洋楽', 20),
  ('rock', 'ロック', 30),
  ('hiphop', 'ヒップホップ', 40),
  ('electronic', '電子音楽', 50),
  ('idol-pop', 'アイドル・ポップス', 60),
  ('new-releases', '新譜・リリース', 70),
  ('misc', '雑談・その他', 80)
on conflict (slug) do nothing;

-- スレッドにカテゴリを紐付ける（nullable。既存スレ・未分類を許容）。
alter table public.discussion_threads
  add column if not exists category_id uuid
    references public.discussion_categories (id) on delete set null;

-- カテゴリ絞り込み一覧（新しい更新順）用のインデックス。
create index if not exists discussion_threads_category_updated_idx
  on public.discussion_threads (category_id, updated_at desc);
