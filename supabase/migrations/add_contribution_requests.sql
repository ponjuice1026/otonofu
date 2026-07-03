-- ユーザーによるデータベース補完（修正依頼・追加リクエスト）
-- Spotify 未収録作品（廃盤・自主制作盤・未配信の旧譜など）を
-- 申請 → 管理者承認制で扱うためのテーブル。
-- Supabase Dashboard → SQL Editor で実行

create table if not exists public.contribution_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('add_artist', 'add_album', 'fix_data')),
  target_artist_id text,      -- fix 時。artists.id は text 型
  target_album_id text,       -- fix 時。albums.id は text 型
  payload jsonb not null,     -- 申請内容（名前・読み・年・レーベル・トラックリスト・修正内容説明など）
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- 本人の申請一覧（/profile）取得用
create index if not exists contribution_requests_requester_idx
  on public.contribution_requests (requester_id, created_at desc);

-- 管理画面の未処理キュー取得用
create index if not exists contribution_requests_pending_idx
  on public.contribution_requests (status, created_at desc)
  where status = 'pending';

alter table public.contribution_requests enable row level security;

-- 本人は自分の申請のみ select 可
drop policy if exists "users can view own contributions"
  on public.contribution_requests;
create policy "users can view own contributions"
  on public.contribution_requests for select
  using (auth.uid() = requester_id);

-- 本人は自分名義でのみ insert 可
drop policy if exists "users can submit own contributions"
  on public.contribution_requests;
create policy "users can submit own contributions"
  on public.contribution_requests for insert
  with check (auth.uid() = requester_id);

-- 管理者は全件 select 可
drop policy if exists "admins can view contributions"
  on public.contribution_requests;
create policy "admins can view contributions"
  on public.contribution_requests for select
  using (public.current_user_is_admin());

-- 管理者は全件 update 可（承認/却下・メモ）
drop policy if exists "admins can update contributions"
  on public.contribution_requests;
create policy "admins can update contributions"
  on public.contribution_requests for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- 通知タイプに 'contribution' を追加（申請の承認/却下を申請者へ通知）
-- add_notifications.sql / add_follow_notification.sql の後に実行すること。
alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (
    type in (
      'thread_reply', 'post_reply', 'review_comment',
      'comment_reply', 'reaction', 'follow', 'contribution'
    )
  );
