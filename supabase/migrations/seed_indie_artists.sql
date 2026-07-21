-- 日本のインディーズ（ロック/ポップ）アーティスト・アルバムの追加シード
-- Supabase Dashboard → SQL Editor で実行してください
-- ※ spotify_id は未設定。アプリは名前から Spotify を自動マッチしてジャケット/曲を表示します。
--    より正確なジャケット・全ディスコグラフィを取り込むには、data/spotify-seeds.txt に
--    追記済みのアーティストを対象に npm run sync:spotify（または GitHub Actions）を実行してください。

insert into public.artists (id, name, name_en, origin, active_from, active_to, genres, bio, career, spotify_id)
values
('haruno', '春野', 'haruno', '日本', 2017, null, array['indie pop','city pop','lo-fi','r&b']::text[],
 'ボカロP出身のシンガーソングライター／トラックメイカー。Lo-Fiヒップホップやジャズ、シティポップをクロスオーバーさせるメロウでグルーヴィなサウンドが特徴。', '[]'::jsonb, null),
('trooper-salute', 'Trooper Salute', 'Trooper Salute', '日本', 2023, null, array['indie rock','shoegaze','math rock']::text[],
 '名古屋発のシンフォニック・インディーロックバンド。女性ボーカルのポップネスとシューゲイズ/マスロック的な音楽性の振り幅で注目を集める。', '[]'::jsonb, null),
('hitsujibungaku', '羊文学', 'Hitsujibungaku', '日本', 2012, null, array['shoegaze','indie rock','dream pop']::text[],
 '塩塚モエカ率いる3人組。轟音のギターと透明感のあるボーカルが同居するシューゲイズ／ドリームポップ・バンド。', '[]'::jsonb, null),
('kinoko-teikoku', 'きのこ帝国', 'Kinoko Teikoku', '日本', 2007, 2019, array['shoegaze','indie rock']::text[],
 '轟音シューゲイズから叙情的なポップまで振れ幅の大きい4人組。2019年より活動休止。', '[]'::jsonb, null),
('regal-lily', 'リーガルリリー', 'Regal Lily', '日本', 2014, null, array['indie rock','alternative']::text[],
 'たかはしほのか率いるオルタナティブ・ロックバンド。繊細な言葉選びと轟音のコントラストが持ち味。', '[]'::jsonb, null)
on conflict (id) do update set
  name = excluded.name,
  origin = excluded.origin,
  active_from = excluded.active_from,
  active_to = excluded.active_to,
  genres = excluded.genres,
  bio = excluded.bio;

insert into public.albums (id, title, artist_id, year, genre, release_type, cover_color, avg_rating, rating_count, spotify_id)
values
('idie-haruno-the-lover', 'The Lover', 'haruno', 2023, '', 'album', 'hsl(268, 40%, 34%)', 0, 0, null),
('idie-haruno-is-she-anybody', 'IS SHE ANYBODY?', 'haruno', 2020, '', 'ep', 'hsl(210, 42%, 36%)', 0, 0, null),
('idie-haruno-25', '25', 'haruno', 2022, '', 'ep', 'hsl(340, 38%, 38%)', 0, 0, null),
('idie-troopersalute-tomodachi', '友達がいました', 'trooper-salute', 2026, '', 'album', 'hsl(48, 55%, 46%)', 0, 0, null),
('idie-troopersalute-ep1', 'Trooper Salute', 'trooper-salute', 2024, '', 'ep', 'hsl(12, 55%, 46%)', 0, 0, null),
('idie-troopersalute-ep2', 'Trooper Salute 2', 'trooper-salute', 2025, '', 'ep', 'hsl(190, 50%, 42%)', 0, 0, null),
('idie-hitsuji-our-hope', 'our hope', 'hitsujibungaku', 2022, '', 'album', 'hsl(150, 30%, 34%)', 0, 0, null),
('idie-hitsuji-12hugs', '12 hugs (like butterflies)', 'hitsujibungaku', 2023, '', 'album', 'hsl(300, 32%, 38%)', 0, 0, null),
('idie-hitsuji-powers', 'POWERS', 'hitsujibungaku', 2020, '', 'album', 'hsl(220, 36%, 36%)', 0, 0, null),
('idie-kinoko-eureka', 'eureka', 'kinoko-teikoku', 2013, '', 'album', 'hsl(196, 44%, 34%)', 0, 0, null),
('idie-kinoko-neko', '猫とアレルギー', 'kinoko-teikoku', 2015, '', 'album', 'hsl(28, 46%, 40%)', 0, 0, null),
('idie-regallily-telephone', 'the Telephone', 'regal-lily', 2019, '', 'album', 'hsl(0, 0%, 30%)', 0, 0, null),
('idie-regallily-c', 'Ｃとし生けるもの', 'regal-lily', 2021, '', 'album', 'hsl(84, 34%, 36%)', 0, 0, null)
on conflict (id) do update set
  title = excluded.title,
  artist_id = excluded.artist_id,
  year = excluded.year,
  release_type = excluded.release_type;
