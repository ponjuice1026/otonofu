-- 評価スケールを 0〜10 に変更（何度実行しても OK）
-- Supabase Dashboard → SQL Editor で実行

-- 1. 5項目カラムがなければ追加（制約なし）
alter table public.reviews
  add column if not exists rating_lyrics numeric(4, 1),
  add column if not exists rating_melody numeric(4, 1),
  add column if not exists rating_performance numeric(4, 1),
  add column if not exists rating_atmosphere numeric(4, 1),
  add column if not exists rating_completion numeric(4, 1);

-- 2. 旧チェック制約を先に削除（データ更新の前に必須）
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'reviews'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ~* 'rating'
  loop
    execute format('alter table public.reviews drop constraint if exists %I', r.conname);
  end loop;

  if to_regclass('public.track_ratings') is not null then
    for r in
      select c.conname
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'track_ratings'
        and c.contype = 'c'
        and pg_get_constraintdef(c.oid) ~* 'rating'
    loop
      execute format('alter table public.track_ratings drop constraint if exists %I', r.conname);
    end loop;
  end if;
end $$;

-- 3. 列型を拡張（10.0 を保存可能に）
alter table public.albums
  alter column avg_rating type numeric(4, 1);

alter table public.reviews
  alter column rating type numeric(4, 1),
  alter column rating_lyrics type numeric(4, 1),
  alter column rating_melody type numeric(4, 1),
  alter column rating_performance type numeric(4, 1),
  alter column rating_atmosphere type numeric(4, 1),
  alter column rating_completion type numeric(4, 1);

do $$
begin
  if to_regclass('public.track_ratings') is not null then
    alter table public.track_ratings
      alter column rating type numeric(4, 1);
  end if;
end $$;

-- 4. 旧 1〜5 スケールのみ ×2（既に 0〜10 ならスキップ）
update public.reviews
set
  rating = rating * 2,
  rating_lyrics = coalesce(rating_lyrics, rating) * 2,
  rating_melody = coalesce(rating_melody, rating) * 2,
  rating_performance = coalesce(rating_performance, rating) * 2,
  rating_atmosphere = coalesce(rating_atmosphere, rating) * 2,
  rating_completion = coalesce(rating_completion, rating) * 2
where user_id is not null
  and rating > 0
  and rating <= 5;

do $$
begin
  if to_regclass('public.track_ratings') is not null then
    update public.track_ratings
    set rating = rating * 2
    where rating > 0 and rating <= 5;
  end if;
end $$;

update public.albums
set avg_rating = avg_rating * 2
where avg_rating > 0 and avg_rating <= 5;

-- 5. 新チェック制約（0〜10）
alter table public.reviews drop constraint if exists reviews_rating_lyrics_check;
alter table public.reviews drop constraint if exists reviews_rating_melody_check;
alter table public.reviews drop constraint if exists reviews_rating_performance_check;
alter table public.reviews drop constraint if exists reviews_rating_atmosphere_check;
alter table public.reviews drop constraint if exists reviews_rating_completion_check;

alter table public.reviews
  add constraint reviews_rating_lyrics_check
    check (rating_lyrics is null or (rating_lyrics >= 0 and rating_lyrics <= 10)),
  add constraint reviews_rating_melody_check
    check (rating_melody is null or (rating_melody >= 0 and rating_melody <= 10)),
  add constraint reviews_rating_performance_check
    check (rating_performance is null or (rating_performance >= 0 and rating_performance <= 10)),
  add constraint reviews_rating_atmosphere_check
    check (rating_atmosphere is null or (rating_atmosphere >= 0 and rating_atmosphere <= 10)),
  add constraint reviews_rating_completion_check
    check (rating_completion is null or (rating_completion >= 0 and rating_completion <= 10));

do $$
begin
  if to_regclass('public.track_ratings') is not null then
    alter table public.track_ratings drop constraint if exists track_ratings_rating_check;
    alter table public.track_ratings
      add constraint track_ratings_rating_check
        check (rating >= 0 and rating <= 10);
  end if;
end $$;

-- 6. アルバム平均を再計算（関数がある場合のみ）
do $$
declare
  album_row record;
  has_refresh_fn boolean;
begin
  select exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'refresh_album_rating'
  ) into has_refresh_fn;

  if not has_refresh_fn then
    return;
  end if;

  for album_row in
    select distinct album_id
    from public.reviews
    where user_id is not null
  loop
    perform public.refresh_album_rating(album_row.album_id);
  end loop;
end $$;
