-- 議題の下書き保存
-- Supabase Dashboard → SQL Editor で実行

alter table public.discussion_threads
  add column if not exists status text not null default 'published'
    check (status in ('draft', 'published'));

create index if not exists discussion_threads_status_updated_idx
  on public.discussion_threads (status, updated_at desc);

create index if not exists discussion_threads_author_draft_idx
  on public.discussion_threads (author_id, updated_at desc)
  where status = 'draft';

drop policy if exists "discussion_threads are viewable by everyone"
  on public.discussion_threads;

create policy "discussion_threads are viewable by everyone"
  on public.discussion_threads for select
  using (
    status = 'published'
    or author_id = auth.uid()
    or public.current_user_is_admin()
  );
