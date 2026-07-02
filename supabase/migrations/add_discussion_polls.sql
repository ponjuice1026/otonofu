-- 議題への投票（選択肢 + 匿名1票）
-- Supabase Dashboard → SQL Editor で実行

create table if not exists public.discussion_poll_options (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.discussion_threads (id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 80),
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  unique (thread_id, position)
);

create index if not exists discussion_poll_options_thread_idx
  on public.discussion_poll_options (thread_id, position);

create table if not exists public.discussion_poll_votes (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.discussion_threads (id) on delete cascade,
  option_id uuid not null references public.discussion_poll_options (id) on delete cascade,
  voter_key text not null check (char_length(voter_key) >= 16),
  created_at timestamptz not null default now(),
  unique (thread_id, voter_key)
);

create index if not exists discussion_poll_votes_option_idx
  on public.discussion_poll_votes (option_id);

alter table public.discussion_poll_options enable row level security;
alter table public.discussion_poll_votes enable row level security;

create policy "poll options are viewable by everyone"
  on public.discussion_poll_options for select using (true);

create policy "thread authors can add poll options"
  on public.discussion_poll_options for insert
  with check (
    exists (
      select 1
      from public.discussion_threads t
      where t.id = thread_id
        and t.author_id = auth.uid()
    )
  );

create policy "poll votes are viewable by everyone"
  on public.discussion_poll_votes for select using (true);

create policy "anyone can vote once per thread"
  on public.discussion_poll_votes for insert
  with check (true);

create or replace function public.touch_thread_on_poll_vote()
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

drop trigger if exists discussion_poll_votes_touch_thread on public.discussion_poll_votes;
create trigger discussion_poll_votes_touch_thread
  after insert on public.discussion_poll_votes
  for each row execute function public.touch_thread_on_poll_vote();
