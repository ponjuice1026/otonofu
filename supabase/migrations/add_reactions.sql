-- レビュー・スレッド投稿に対する good / bad リアクション
-- Supabase Dashboard → SQL Editor で実行

create table if not exists public.review_reactions (
  id uuid primary key default gen_random_uuid(),
  review_id text not null references public.reviews (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  voter_key text,
  reaction text not null check (reaction in ('good', 'bad')),
  created_at timestamptz not null default now(),
  constraint review_reactions_subject_check
    check ((user_id is not null) or (voter_key is not null))
);

create unique index if not exists review_reactions_user_uniq
  on public.review_reactions (review_id, user_id)
  where user_id is not null;

create unique index if not exists review_reactions_voter_uniq
  on public.review_reactions (review_id, voter_key)
  where voter_key is not null and user_id is null;

create index if not exists review_reactions_review_idx
  on public.review_reactions (review_id);

alter table public.review_reactions enable row level security;

drop policy if exists "review_reactions are viewable by everyone" on public.review_reactions;
create policy "review_reactions are viewable by everyone"
  on public.review_reactions for select using (true);

drop policy if exists "anyone can react to a review" on public.review_reactions;
create policy "anyone can react to a review"
  on public.review_reactions for insert
  with check (true);

drop policy if exists "anyone can update their own review reaction" on public.review_reactions;
create policy "anyone can update their own review reaction"
  on public.review_reactions for update
  using (
    (user_id is not null and auth.uid() = user_id)
    or (user_id is null)
  )
  with check (
    (user_id is not null and auth.uid() = user_id)
    or (user_id is null)
  );

drop policy if exists "anyone can delete their own review reaction" on public.review_reactions;
create policy "anyone can delete their own review reaction"
  on public.review_reactions for delete
  using (
    (user_id is not null and auth.uid() = user_id)
    or (user_id is null)
  );


create table if not exists public.discussion_post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.discussion_posts (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  voter_key text,
  reaction text not null check (reaction in ('good', 'bad')),
  created_at timestamptz not null default now(),
  constraint discussion_post_reactions_subject_check
    check ((user_id is not null) or (voter_key is not null))
);

create unique index if not exists discussion_post_reactions_user_uniq
  on public.discussion_post_reactions (post_id, user_id)
  where user_id is not null;

create unique index if not exists discussion_post_reactions_voter_uniq
  on public.discussion_post_reactions (post_id, voter_key)
  where voter_key is not null and user_id is null;

create index if not exists discussion_post_reactions_post_idx
  on public.discussion_post_reactions (post_id);

alter table public.discussion_post_reactions enable row level security;

drop policy if exists "post_reactions are viewable by everyone" on public.discussion_post_reactions;
create policy "post_reactions are viewable by everyone"
  on public.discussion_post_reactions for select using (true);

drop policy if exists "anyone can react to a post" on public.discussion_post_reactions;
create policy "anyone can react to a post"
  on public.discussion_post_reactions for insert
  with check (true);

drop policy if exists "anyone can update their own post reaction" on public.discussion_post_reactions;
create policy "anyone can update their own post reaction"
  on public.discussion_post_reactions for update
  using (
    (user_id is not null and auth.uid() = user_id)
    or (user_id is null)
  )
  with check (
    (user_id is not null and auth.uid() = user_id)
    or (user_id is null)
  );

drop policy if exists "anyone can delete their own post reaction" on public.discussion_post_reactions;
create policy "anyone can delete their own post reaction"
  on public.discussion_post_reactions for delete
  using (
    (user_id is not null and auth.uid() = user_id)
    or (user_id is null)
  );
