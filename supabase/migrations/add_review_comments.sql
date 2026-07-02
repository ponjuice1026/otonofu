-- レビューに対する匿名コメント
-- Supabase Dashboard → SQL Editor で実行

create table if not exists public.review_comments (
  id uuid primary key default gen_random_uuid(),
  review_id text not null references public.reviews (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  anonymous_name text not null check (char_length(trim(anonymous_name)) between 1 and 24),
  body text not null check (char_length(trim(body)) between 1 and 2000),
  parent_comment_id uuid references public.review_comments (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists review_comments_review_idx
  on public.review_comments (review_id, created_at asc);

create index if not exists review_comments_parent_idx
  on public.review_comments (parent_comment_id);

alter table public.review_comments enable row level security;

drop policy if exists "review_comments are viewable by everyone" on public.review_comments;
create policy "review_comments are viewable by everyone"
  on public.review_comments for select using (true);

drop policy if exists "anyone can comment on reviews" on public.review_comments;
create policy "anyone can comment on reviews"
  on public.review_comments for insert
  with check (true);

drop policy if exists "comment authors can delete own" on public.review_comments;
create policy "comment authors can delete own"
  on public.review_comments for delete
  using (author_id is not null and auth.uid() = author_id);

drop policy if exists "admins can delete review comments" on public.review_comments;
create policy "admins can delete review comments"
  on public.review_comments for delete
  using (public.current_user_is_admin());
