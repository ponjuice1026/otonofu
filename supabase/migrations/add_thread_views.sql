-- スレッドの閲覧数（人気順ソート用）
-- Supabase Dashboard → SQL Editor で実行

alter table public.discussion_threads
  add column if not exists view_count integer not null default 0;

create index if not exists discussion_threads_view_count_idx
  on public.discussion_threads (view_count desc, updated_at desc);

create or replace function public.increment_thread_views(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.discussion_threads
  set view_count = view_count + 1
  where id = target_id;
end;
$$;

grant execute on function public.increment_thread_views(uuid) to anon, authenticated;
