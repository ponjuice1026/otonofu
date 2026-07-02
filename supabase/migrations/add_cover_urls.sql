-- アルバムジャケット・アーティスト画像 URL（Spotify 同期時に保存）
alter table public.artists
  add column if not exists image_url text;

alter table public.albums
  add column if not exists cover_url text;
