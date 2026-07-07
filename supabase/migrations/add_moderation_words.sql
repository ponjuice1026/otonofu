-- NG ワード（禁止語）の DB 化
-- Supabase Dashboard → SQL Editor で実行
--
-- 背景:
--   これまで禁止語は lib/moderation.ts の BANNED_PATTERNS（空配列）に直書きで、
--   語を追加するたびにデプロイが必要だった。DB テーブル化して管理画面から
--   運用できるようにする。
--
-- 対策:
--   banned_words テーブルを追加し、管理者のみ CRUD できる RLS を張る。
--   通常語は ilike/position で部分一致、is_regex=true は body ~* pattern で判定。
--   照合ロジックは挿入 RPC 内の otonofu_assert_content_ok にも組み込み、
--   DB 直叩きでも NG ワードを弾く（多層防御）。関数の create or replace は
--   後続の update_moderation_rpc.sql で行う。
--
-- 前提: add_admin_role.sql（current_user_is_admin() ヘルパ）を先に適用済みであること。

create table if not exists public.banned_words (
  id uuid primary key default gen_random_uuid(),
  pattern text not null check (char_length(trim(pattern)) between 1 and 200),
  is_regex boolean not null default false,
  note text check (note is null or char_length(note) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists banned_words_created_at_idx
  on public.banned_words (created_at desc);

alter table public.banned_words enable row level security;

-- 管理者のみ全操作可（add_content_reports.sql の管理者ポリシーに準拠）。
drop policy if exists "admins can view banned words" on public.banned_words;
create policy "admins can view banned words"
  on public.banned_words for select
  using (public.current_user_is_admin());

drop policy if exists "admins can insert banned words" on public.banned_words;
create policy "admins can insert banned words"
  on public.banned_words for insert
  with check (public.current_user_is_admin());

drop policy if exists "admins can update banned words" on public.banned_words;
create policy "admins can update banned words"
  on public.banned_words for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

drop policy if exists "admins can delete banned words" on public.banned_words;
create policy "admins can delete banned words"
  on public.banned_words for delete
  using (public.current_user_is_admin());
