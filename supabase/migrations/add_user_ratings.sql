-- ログインユーザーのアルバムレビュー（評価+コメント）と曲評価
-- Supabase Dashboard → SQL Editor で実行

-- プロフィール（auth.users と 1:1）
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- 新規登録時にプロフィール自動作成
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_name text;
  candidate text;
begin
  base_name := coalesce(nullif(split_part(new.email, '@', 1), ''), 'user');
  candidate := base_name || '_' || substring(new.id::text, 1, 8);

  insert into public.profiles (id, username, display_name)
  values (new.id, candidate, base_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- reviews に user_id を追加（ログインユーザー用）
alter table public.reviews
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table public.reviews
  add column if not exists updated_at timestamptz default now();

create unique index if not exists reviews_user_album_unique
  on public.reviews (user_id, album_id)
  where user_id is not null;

-- 曲評価（Spotify track ID で識別）
create table if not exists public.track_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  album_id text not null references public.albums (id) on delete cascade,
  spotify_track_id text not null,
  track_number integer not null,
  track_name text not null,
  rating numeric(2, 1) not null check (rating >= 1 and rating <= 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, album_id, spotify_track_id)
);

create index if not exists track_ratings_album_idx
  on public.track_ratings (album_id);

alter table public.track_ratings enable row level security;

create policy "track_ratings are viewable by everyone"
  on public.track_ratings for select using (true);

create policy "users can insert own track ratings"
  on public.track_ratings for insert
  with check (auth.uid() = user_id);

create policy "users can update own track ratings"
  on public.track_ratings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can delete own track ratings"
  on public.track_ratings for delete
  using (auth.uid() = user_id);

-- reviews RLS（ログインユーザーのみ書き込み）
create policy "users can insert own reviews"
  on public.reviews for insert
  with check (auth.uid() = user_id);

create policy "users can update own reviews"
  on public.reviews for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can delete own reviews"
  on public.reviews for delete
  using (auth.uid() = user_id);

-- アルバム平均評価を reviews から再計算
create or replace function public.refresh_album_rating(target_album_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.albums
  set
    avg_rating = coalesce(
      (
        select round(avg(rating)::numeric, 1)
        from public.reviews
        where album_id = target_album_id
          and user_id is not null
      ),
      0
    ),
    rating_count = (
      select count(*)::integer
      from public.reviews
      where album_id = target_album_id
        and user_id is not null
    )
  where id = target_album_id;
end;
$$;

create or replace function public.trigger_refresh_album_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_album_rating(old.album_id);
    return old;
  end if;

  perform public.refresh_album_rating(new.album_id);
  return new;
end;
$$;

drop trigger if exists reviews_refresh_album_rating on public.reviews;
create trigger reviews_refresh_album_rating
  after insert or update or delete on public.reviews
  for each row
  execute function public.trigger_refresh_album_rating();
