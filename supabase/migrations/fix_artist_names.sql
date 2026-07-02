-- Spotify 同期で英語名になっていたアーティスト名を修正
-- name = 公式名（日本語）、name_en = Spotify の英語表記
-- Supabase SQL Editor で実行

update public.artists set name = '椎名林檎', name_en = 'Sheena Ringo'
where spotify_id = '2XjqKvB2Xz9IdyjWPIHaXi';

update public.artists set name = '松任谷由実', name_en = 'Yumi Matsutoya'
where spotify_id = '1LQQtqc1vQ1neUgZrjYlEU';

update public.artists set name = '藤井風', name_en = 'Fujii Kaze'
where spotify_id = '6bDWAcdtVR3WHz2xtiIPUi';

update public.artists set name = 'サカナクション', name_en = 'sakanaction'
where spotify_id = '0hCWVMGGQnRVfDgmhwLIxq';

update public.artists set name = '東京事変', name_en = 'Tokyo Incidents'
where spotify_id = '6KQWWzFLPQbqomJrieHAW5';

update public.artists set name = 'Official髭男dism', name_en = 'OFFICIAL HIGE DANDISM'
where spotify_id = '5Vo1hnCRmCM6M4thZCInCj';

update public.artists set name = 'クリープハイプ', name_en = 'Creep Hyp'
where spotify_id = '6POfB0fHdzXFLWL3RHxLv8';

update public.artists set name = '竹内まりや', name_en = 'Mariya Takeuchi'
where spotify_id = '3WwGRA2o4Ux1RRMYaYDh7N';

update public.artists set name = '山下达郎', name_en = 'Tatsuro Yamashita'
where spotify_id = '41hQ0PoEyj9xEBhwt73aWC';

update public.artists set name = '宇多田ヒカル', name_en = 'Hikaru Utada'
where spotify_id = '7lbSsjYACZHn1MSDXPxNF2';

update public.artists set name = '米津玄師', name_en = null
where spotify_id = '3DkjnIlZW4U13Kt5M0lD55';

-- name と name_en が同一の英語名のみの行は name_en を null に
update public.artists set name_en = null
where name_en is not null and name = name_en;
