-- 日髙 晴野 の追加シード
-- Supabase Dashboard → SQL Editor で実行してください
--
-- 経緯: seed_indie_artists.sql では「春野」(haruno / ボカロP出身のSSW) が登録されたが、
--       意図されていたのは別アーティストの「日髙 晴野」だった。春野はそのまま残す。
--
-- 収録内容は Spotify API で実在を確認済み（2026-07-21 時点）:
--   artist_id 3szjk9vbQMiTS9avR1hEcP / リリース4作（アルバムはなく全てシングル・EP）
-- 経歴やジャンルは公開情報が乏しいため、確認できた事実のみを記載している。

insert into public.artists (id, name, name_en, origin, active_from, active_to, genres, bio, career, spotify_id)
values
('hidaka-haruno', '日髙 晴野', 'Hidaka Haruno', '日本', 2024, null,
 array['indie']::text[],
 '2024年10月に「白昼夢」「（日記）」を配信リリースしてから活動しているインディーズ・アーティスト。以降もシングル／EPを継続的に発表している。',
 '[]'::jsonb, '3szjk9vbQMiTS9avR1hEcP')
on conflict (id) do update set
  name = excluded.name,
  name_en = excluded.name_en,
  origin = excluded.origin,
  active_from = excluded.active_from,
  active_to = excluded.active_to,
  genres = excluded.genres,
  bio = excluded.bio,
  spotify_id = excluded.spotify_id;

-- リリース（Spotify の release_date に基づく。フルアルバムは未発表）
-- release_type は 'album' | 'ep' | 'compilation' のみ。Spotify の single は
-- lib/spotify/sync.ts の mapReleaseType と同じく 'ep' に寄せる。
insert into public.albums (id, title, artist_id, year, genre, release_type, cover_color, avg_rating, rating_count, spotify_id)
values
('idie-hidakaharuno-hakuchumu', '白昼夢', 'hidaka-haruno', 2024, '', 'ep', 'hsl(214, 40%, 36%)', 0, 0, '56tyKfdEtMNRs2FK6qwJFO'),
('idie-hidakaharuno-nikki', '（日記）', 'hidaka-haruno', 2024, '', 'ep', 'hsl(32, 38%, 38%)', 0, 0, '1HyGoanX3LfLy6ZshtFuTd'),
('idie-hidakaharuno-hakusakusha', '白柵舎', 'hidaka-haruno', 2025, '', 'ep', 'hsl(152, 34%, 34%)', 0, 0, '3L80NyLI2et1umA9LakEVo'),
('idie-hidakaharuno-harunokarada', '春の身体 (feat.砂場泥棒)', 'hidaka-haruno', 2026, '', 'ep', 'hsl(342, 40%, 40%)', 0, 0, '7EClmzrC7bzGRbk82f27Ej')
on conflict (id) do update set
  title = excluded.title,
  artist_id = excluded.artist_id,
  year = excluded.year,
  release_type = excluded.release_type,
  spotify_id = excluded.spotify_id;
