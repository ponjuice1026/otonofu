-- 得票集計に含めない「結果閲覧用」投票選択肢
-- Supabase Dashboard → SQL Editor で実行

alter table public.discussion_poll_options
  add column if not exists exclude_from_tally boolean not null default false;

create index if not exists discussion_poll_options_view_only_idx
  on public.discussion_poll_options (thread_id, exclude_from_tally)
  where exclude_from_tally = true;

create or replace function public.add_discussion_poll_option_by_participant(
  target_thread_id uuid,
  participant_key text,
  option_type text,
  option_label text,
  option_album_id text default null,
  option_artist_id text default null,
  option_exclude_from_tally boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  author_id uuid;
  option_count integer;
  next_position integer;
  normalized_label text;
  new_id uuid;
begin
  if participant_key is null or char_length(trim(participant_key)) < 16 then
    raise exception 'invalid participant key';
  end if;

  normalized_label := trim(option_label);
  if char_length(normalized_label) < 1 or char_length(normalized_label) > 80 then
    raise exception 'invalid option label';
  end if;

  if option_exclude_from_tally and option_type <> 'text' then
    raise exception 'view-only options must be text';
  end if;

  if option_type not in ('text', 'album', 'artist') then
    raise exception 'invalid option type';
  end if;

  select t.author_id
  into author_id
  from public.discussion_threads t
  where t.id = target_thread_id;

  if author_id is null then
    raise exception 'thread not found';
  end if;

  if auth.uid() is not null and auth.uid() = author_id then
    raise exception 'thread author cannot add options';
  end if;

  if not exists (
    select 1
    from public.discussion_thread_participants p
    where p.thread_id = target_thread_id
      and p.participant_key = add_discussion_poll_option_by_participant.participant_key
  ) then
    raise exception 'not a thread participant';
  end if;

  select count(*)
  into option_count
  from public.discussion_poll_options
  where thread_id = target_thread_id;

  if option_count = 0 then
    raise exception 'thread has no poll';
  end if;

  if option_count >= 8 then
    raise exception 'poll option limit reached';
  end if;

  if option_type = 'album' and option_album_id is null then
    raise exception 'album option requires album id';
  end if;

  if option_type = 'artist' and option_artist_id is null then
    raise exception 'artist option requires artist id';
  end if;

  if option_type = 'text' and exists (
    select 1
    from public.discussion_poll_options o
    where o.thread_id = target_thread_id
      and o.option_type = 'text'
      and lower(trim(o.label)) = lower(normalized_label)
  ) then
    raise exception 'duplicate poll option';
  end if;

  if option_type = 'album' and exists (
    select 1
    from public.discussion_poll_options o
    where o.thread_id = target_thread_id
      and o.album_id = option_album_id
  ) then
    raise exception 'duplicate poll option';
  end if;

  if option_type = 'artist' and exists (
    select 1
    from public.discussion_poll_options o
    where o.thread_id = target_thread_id
      and o.artist_id = option_artist_id
  ) then
    raise exception 'duplicate poll option';
  end if;

  select coalesce(max(position), -1) + 1
  into next_position
  from public.discussion_poll_options
  where thread_id = target_thread_id;

  insert into public.discussion_poll_options (
    thread_id,
    label,
    position,
    option_type,
    album_id,
    artist_id,
    exclude_from_tally
  )
  values (
    target_thread_id,
    normalized_label,
    next_position,
    option_type,
    case when option_type = 'album' then option_album_id else null end,
    case when option_type = 'artist' then option_artist_id else null end,
    coalesce(option_exclude_from_tally, false)
  )
  returning id into new_id;

  update public.discussion_threads
  set updated_at = now()
  where id = target_thread_id;

  return new_id;
end;
$$;

grant execute on function public.add_discussion_poll_option_by_participant(uuid, text, text, text, text, text, boolean) to anon, authenticated;
