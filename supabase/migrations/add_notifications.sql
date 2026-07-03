-- 通知機能
-- 自分のスレッドへの返信・レビューへのコメント・goodリアクションを通知する
-- Supabase Dashboard → SQL Editor で実行

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (
    type in ('thread_reply', 'post_reply', 'review_comment', 'comment_reply', 'reaction')
  ),
  actor_name text not null,          -- 表示名（匿名対応のためID参照でなく名前を保存）
  thread_id uuid,                    -- 遷移先解決用
  review_id text,                    -- reviews.id は text型なので注意
  post_id uuid,
  comment_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- 本人のみ閲覧可
drop policy if exists "users can view own notifications" on public.notifications;
create policy "users can view own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

-- 本人のみ更新可（read_at の更新用）
drop policy if exists "users can update own notifications" on public.notifications;
create policy "users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- insert はRLSで直接許可せず、security definer 関数経由でのみ作成する
-- （他人宛の通知を任意に作れてしまうのを防ぐ）
create or replace function public.create_notification(
  target_user_id uuid,
  notification_type text,
  actor_name text,
  target_thread_id uuid default null,
  target_review_id text default null,
  target_post_id uuid default null,
  target_comment_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 宛先不明・自分自身宛はスキップ
  if target_user_id is null then
    return;
  end if;
  if target_user_id = auth.uid() then
    return;
  end if;

  insert into public.notifications (
    user_id, type, actor_name,
    thread_id, review_id, post_id, comment_id
  ) values (
    target_user_id, notification_type, actor_name,
    target_thread_id, target_review_id, target_post_id, target_comment_id
  );
end;
$$;

grant execute on function public.create_notification(
  uuid, text, text, uuid, text, uuid, uuid
) to anon, authenticated;
