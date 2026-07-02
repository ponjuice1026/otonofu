-- 「君は天然色」は大瀧詠一の作品（A Long Vacation 収録）の修正
-- Supabase SQL Editor で実行

insert into public.artists (id, name, name_en, origin, active_from, active_to, genres, bio, career, spotify_id)
values (
  'ohtaki-eiichi',
  '大瀧詠一',
  'Eiichi Ohtaki',
  '北海道',
  1970,
  2013,
  array['シティポップ', 'ロック', 'AOR'],
  'Happy End のギタリスト・作詞作曲家。「君は天然色」「A Long Vacation」などシティポップの金字塔を生み出した。',
  '[{"year":1970,"label":"Happy End 結成"},{"year":1981,"label":"『A Long Vacation』","description":"「君は天然色」収録"},{"year":2013,"label":"急逝"}]'::jsonb,
  '0cFJWqLH2LZPzuTGS1ljV0'
)
on conflict (id) do update set
  name = excluded.name,
  name_en = excluded.name_en,
  bio = excluded.bio,
  career = excluded.career,
  spotify_id = excluded.spotify_id;

update public.albums
set
  title = 'A Long Vacation',
  artist_id = 'ohtaki-eiichi',
  year = 1981,
  genre = 'シティポップ',
  spotify_id = '3eUV7xEoXqQb43ek7Db04H'
where id = '1';

insert into public.albums (id, title, artist_id, year, genre, release_type, cover_color, avg_rating, rating_count, spotify_id)
values ('12', 'SURF & SNOW', 'yumi-arai', 1980, 'シティポップ', 'album', '#b8860b', 0, 0, '6T00pjmcIwiUhF0Jc7TGRr')
on conflict (id) do update set
  title = excluded.title,
  artist_id = excluded.artist_id,
  year = excluded.year,
  genre = excluded.genre,
  spotify_id = excluded.spotify_id;
