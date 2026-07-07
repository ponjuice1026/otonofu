-- BAN 機構（荒らし対策）
-- Supabase Dashboard → SQL Editor で実行
--
-- 背景:
--   匿名投稿可のため荒らしを止める手段が無かった。匿名(voter_key)と
--   ログイン(user_id)の両方を BAN 対象にできるようにする。
--
-- 対策:
--   user_bans テーブルを追加し、管理者のみ CRUD できる RLS を張る。
--   otonofu_is_banned(subject_user, subject_voter) が「有効な BAN が存在するか」を
--   security definer で判定する。挿入 RPC の冒頭でこれを呼び、BAN 対象なら
--   例外 'banned' を投げる（DB 直叩きでも弾ける）。関数の create or replace は
--   後続の update_moderation_rpc.sql で行う。
--
-- 前提: add_admin_role.sql（current_user_is_admin() ヘルパ）を先に適用済みであること。

create table if not exists public.user_bans (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('user', 'voter')),
  subject_key text not null check (char_length(trim(subject_key)) between 1 and 200),
  reason text check (reason is null or char_length(reason) <= 500),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

-- 「有効な BAN が存在するか」を高速に引くための索引。
create index if not exists user_bans_subject_idx
  on public.user_bans (subject_type, subject_key);

create index if not exists user_bans_created_at_idx
  on public.user_bans (created_at desc);

alter table public.user_bans enable row level security;

-- 管理者のみ全操作可。
drop policy if exists "admins can view bans" on public.user_bans;
create policy "admins can view bans"
  on public.user_bans for select
  using (public.current_user_is_admin());

drop policy if exists "admins can insert bans" on public.user_bans;
create policy "admins can insert bans"
  on public.user_bans for insert
  with check (public.current_user_is_admin());

drop policy if exists "admins can update bans" on public.user_bans;
create policy "admins can update bans"
  on public.user_bans for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

drop policy if exists "admins can delete bans" on public.user_bans;
create policy "admins can delete bans"
  on public.user_bans for delete
  using (public.current_user_is_admin());

-- ---------------------------------------------------------------------------
-- BAN 判定ヘルパ（security definer）
--   subject_user: 判定対象のログインユーザー uuid（未ログインなら null）
--   subject_voter: 判定対象の voter_key（無ければ null）
--   有効な BAN（expires_at is null or expires_at > now()）が
--   user または voter のいずれかに該当すれば true。
-- ---------------------------------------------------------------------------
create or replace function public.otonofu_is_banned(
  subject_user uuid,
  subject_voter text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_bans b
    where (b.expires_at is null or b.expires_at > now())
      and (
        (subject_user is not null and b.subject_type = 'user' and b.subject_key = subject_user::text)
        or (subject_voter is not null and b.subject_type = 'voter' and b.subject_key = subject_voter)
      )
  );
$$;

grant execute on function public.otonofu_is_banned(uuid, text) to anon, authenticated;
