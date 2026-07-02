-- ユーザー生成コンテンツの通報
-- Supabase Dashboard → SQL Editor で実行

create type public.content_report_target_type as enum (
  'discussion_post',
  'review',
  'review_comment'
);

create type public.content_report_reason as enum (
  'spam',
  'harassment',
  'inappropriate',
  'other'
);

create type public.content_report_status as enum (
  'pending',
  'resolved',
  'dismissed'
);

create type public.content_report_resolution as enum (
  'deleted',
  'dismissed'
);

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  target_type public.content_report_target_type not null,
  target_id text not null,
  reporter_user_id uuid references auth.users (id) on delete set null,
  reporter_voter_key text,
  reason public.content_report_reason not null,
  details text check (details is null or char_length(trim(details)) <= 500),
  status public.content_report_status not null default 'pending',
  resolution public.content_report_resolution,
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (reporter_user_id is not null or reporter_voter_key is not null)
);

create unique index if not exists content_reports_user_unique
  on public.content_reports (target_type, target_id, reporter_user_id)
  where reporter_user_id is not null;

create unique index if not exists content_reports_voter_unique
  on public.content_reports (target_type, target_id, reporter_voter_key)
  where reporter_user_id is null and reporter_voter_key is not null;

create index if not exists content_reports_pending_idx
  on public.content_reports (status, created_at desc)
  where status = 'pending';

create index if not exists content_reports_target_idx
  on public.content_reports (target_type, target_id, status);

alter table public.content_reports enable row level security;

drop policy if exists "anyone can submit content reports" on public.content_reports;
create policy "anyone can submit content reports"
  on public.content_reports for insert
  with check (
    (
      auth.uid() is not null
      and reporter_user_id = auth.uid()
      and reporter_voter_key is null
    )
    or (
      auth.uid() is null
      and reporter_user_id is null
      and reporter_voter_key is not null
    )
  );

drop policy if exists "admins can view content reports" on public.content_reports;
create policy "admins can view content reports"
  on public.content_reports for select
  using (public.current_user_is_admin());

drop policy if exists "admins can update content reports" on public.content_reports;
create policy "admins can update content reports"
  on public.content_reports for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

-- 管理者はレビュー本体も削除できる
drop policy if exists "admins can delete any review" on public.reviews;
create policy "admins can delete any review"
  on public.reviews for delete
  using (public.current_user_is_admin());
