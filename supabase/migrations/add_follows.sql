-- フォロー機能
-- ユーザー同士のソーシャルグラフ（follower_id が followee_id をフォローする）
-- Supabase Dashboard → SQL Editor で実行

create table if not exists public.user_follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  followee_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

-- フォロワー数・フォロー数の集計や一覧取得用のインデックス
create index if not exists user_follows_followee_idx
  on public.user_follows (followee_id, created_at desc);
create index if not exists user_follows_follower_idx
  on public.user_follows (follower_id, created_at desc);

alter table public.user_follows enable row level security;

-- select は全員可（フォロワー数・フォロー中一覧を公開表示するため）
drop policy if exists "anyone can view follows" on public.user_follows;
create policy "anyone can view follows"
  on public.user_follows for select
  using (true);

-- insert は本人（follower_id = auth.uid()）のみ
drop policy if exists "users can follow as themselves" on public.user_follows;
create policy "users can follow as themselves"
  on public.user_follows for insert
  with check (auth.uid() = follower_id);

-- delete は本人（follower_id = auth.uid()）のみ
drop policy if exists "users can unfollow as themselves" on public.user_follows;
create policy "users can unfollow as themselves"
  on public.user_follows for delete
  using (auth.uid() = follower_id);
