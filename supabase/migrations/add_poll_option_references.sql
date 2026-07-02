-- 投票選択肢にアルバム／アーティスト参照を追加
-- Supabase Dashboard → SQL Editor で実行

alter table public.discussion_poll_options
  add column if not exists option_type text not null default 'text'
    check (option_type in ('text', 'album', 'artist')),
  add column if not exists album_id text references public.albums (id) on delete set null,
  add column if not exists artist_id text references public.artists (id) on delete set null;

create index if not exists discussion_poll_options_album_idx
  on public.discussion_poll_options (album_id)
  where album_id is not null;

create index if not exists discussion_poll_options_artist_idx
  on public.discussion_poll_options (artist_id)
  where artist_id is not null;
