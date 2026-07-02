-- 未適用マイグレーションを安全に一括実行（Supabase SQL Editor 用）
-- エラーが出ても、既に適用済みの部分はスキップされます

-- cover URLs
alter table public.artists
  add column if not exists image_url text;

alter table public.albums
  add column if not exists cover_url text;

-- album tracks
alter table public.albums
  add column if not exists tracks jsonb not null default '[]'::jsonb;

-- profiles insert policy + backfill
drop policy if exists "users can insert own profile" on public.profiles;

create policy "users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

insert into public.profiles (id, username, display_name)
select
  u.id,
  coalesce(nullif(split_part(u.email, '@', 1), ''), 'user')
    || '_'
    || substring(u.id::text, 1, 8),
  coalesce(nullif(split_part(u.email, '@', 1), ''), 'user')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- album criteria ratings (5 items)
alter table public.reviews
  add column if not exists rating_lyrics numeric(2, 1)
    check (rating_lyrics is null or (rating_lyrics >= 1 and rating_lyrics <= 5)),
  add column if not exists rating_melody numeric(2, 1)
    check (rating_melody is null or (rating_melody >= 1 and rating_melody <= 5)),
  add column if not exists rating_performance numeric(2, 1)
    check (rating_performance is null or (rating_performance >= 1 and rating_performance <= 5)),
  add column if not exists rating_atmosphere numeric(2, 1)
    check (rating_atmosphere is null or (rating_atmosphere >= 1 and rating_atmosphere <= 5)),
  add column if not exists rating_completion numeric(2, 1)
    check (rating_completion is null or (rating_completion >= 1 and rating_completion <= 5));

update public.reviews
set
  rating_lyrics = rating,
  rating_melody = rating,
  rating_performance = rating,
  rating_atmosphere = rating,
  rating_completion = rating
where user_id is not null
  and rating_lyrics is null;

-- review sessions (reviews → discussion_threads)
alter table public.reviews
  add column if not exists session_opt_out boolean not null default false;

alter table public.discussion_threads
  add column if not exists review_id text references public.reviews (id) on delete cascade,
  add column if not exists album_id text references public.albums (id) on delete set null;

create unique index if not exists discussion_threads_review_id_unique
  on public.discussion_threads (review_id)
  where review_id is not null;

create index if not exists discussion_threads_album_id_idx
  on public.discussion_threads (album_id)
  where album_id is not null;

insert into public.discussion_threads (
  author_id,
  title,
  body,
  status,
  review_id,
  album_id,
  created_at,
  updated_at
)
select
  r.user_id,
  left(r.album_title || ' のレビュー', 120),
  left(
    trim(
      both E'\n' from
      concat_ws(
        E'\n\n',
        nullif(trim(r.body), ''),
        '総合評価: ' || trim(to_char(r.rating, 'FM999990.0')) || '/10'
      )
    ),
    4000
  ),
  'published',
  r.id,
  r.album_id,
  coalesce(r.updated_at::timestamptz, r.created_at::timestamptz, now()),
  coalesce(r.updated_at::timestamptz, r.created_at::timestamptz, now())
from public.reviews r
where r.user_id is not null
  and r.session_opt_out = false
  and not exists (
    select 1
    from public.discussion_threads t
    where t.review_id = r.id
  );
