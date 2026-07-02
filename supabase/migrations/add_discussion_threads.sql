-- スレッド（議題）と匿名投稿
-- Supabase Dashboard → SQL Editor で実行

create table if not exists public.discussion_threads (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  body text not null default '' check (char_length(body) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists discussion_threads_updated_idx
  on public.discussion_threads (updated_at desc);

create table if not exists public.discussion_posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.discussion_threads (id) on delete cascade,
  anonymous_name text not null check (char_length(trim(anonymous_name)) between 1 and 24),
  body text not null check (char_length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists discussion_posts_thread_idx
  on public.discussion_posts (thread_id, created_at asc);

alter table public.discussion_threads enable row level security;
alter table public.discussion_posts enable row level security;

create policy "discussion_threads are viewable by everyone"
  on public.discussion_threads for select using (true);

create policy "authenticated users can create threads"
  on public.discussion_threads for insert
  with check (auth.uid() = author_id);

create policy "authors can update own threads"
  on public.discussion_threads for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

create policy "authors can delete own threads"
  on public.discussion_threads for delete
  using (auth.uid() = author_id);

create policy "discussion_posts are viewable by everyone"
  on public.discussion_posts for select using (true);

-- ログイン不要。誰でも匿名で投稿可能
create policy "anyone can post anonymously"
  on public.discussion_posts for insert
  with check (true);

create or replace function public.touch_discussion_thread()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.discussion_threads
  set updated_at = now()
  where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists discussion_posts_touch_thread on public.discussion_posts;
create trigger discussion_posts_touch_thread
  after insert on public.discussion_posts
  for each row execute function public.touch_discussion_thread();
