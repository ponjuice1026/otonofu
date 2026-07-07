-- 投票選択肢のアルバム／アーティスト列を確実に用意し、PostgREST スキーマキャッシュを更新する
-- 症状: アルバム/アーティストを選択肢にした投票を投稿すると
--       「Could not find the 'album_id' column of 'discussion_poll_options' in the schema cache」
--       で失敗する（テキスト選択肢は成功する）。
-- 対処: Supabase Dashboard → SQL Editor にこの内容を貼り付けて実行してください。
--       すでに適用済みでも安全に再実行できます（idempotent）。

-- 1) 不足している列を追加（存在すればスキップ）
alter table public.discussion_poll_options
  add column if not exists option_type text not null default 'text'
    check (option_type in ('text', 'album', 'artist')),
  add column if not exists album_id text references public.albums (id) on delete set null,
  add column if not exists artist_id text references public.artists (id) on delete set null,
  add column if not exists exclude_from_tally boolean not null default false;

-- 2) 参照用インデックス（存在すればスキップ）
create index if not exists discussion_poll_options_album_idx
  on public.discussion_poll_options (album_id)
  where album_id is not null;

create index if not exists discussion_poll_options_artist_idx
  on public.discussion_poll_options (artist_id)
  where artist_id is not null;

create index if not exists discussion_poll_options_view_only_idx
  on public.discussion_poll_options (thread_id, exclude_from_tally)
  where exclude_from_tally = true;

-- 3) PostgREST のスキーマキャッシュを再読み込み
--    （列は追加済みだがキャッシュが古い場合、これだけで直ることもあります）
notify pgrst, 'reload schema';

-- 4) 確認: 4 行（option_type, album_id, artist_id, exclude_from_tally）が返れば OK
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'discussion_poll_options'
  and column_name in ('option_type', 'album_id', 'artist_id', 'exclude_from_tally')
order by column_name;
