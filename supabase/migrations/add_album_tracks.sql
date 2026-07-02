-- アルバム収録曲（Spotify 同期時に JSON 保存）
alter table public.albums
  add column if not exists tracks jsonb not null default '[]'::jsonb;
