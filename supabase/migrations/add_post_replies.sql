-- コメントへの返信
-- Supabase Dashboard → SQL Editor で実行

alter table public.discussion_posts
  add column if not exists parent_post_id uuid
    references public.discussion_posts (id) on delete set null;

create index if not exists discussion_posts_parent_idx
  on public.discussion_posts (parent_post_id)
  where parent_post_id is not null;
