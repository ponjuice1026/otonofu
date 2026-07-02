-- オトノフ: Supabase スキーマ
-- Supabase Dashboard → SQL Editor でこのファイルを実行してください

create table if not exists public.artists (
  id text primary key,
  name text not null,
  name_en text,
  origin text not null default '',
  active_from integer not null,
  active_to integer,
  genres text[] not null default '{}',
  bio text not null default '',
  career jsonb not null default '[]',
  spotify_id text,
  image_url text
);

create table if not exists public.albums (
  id text primary key,
  title text not null,
  artist_id text not null references public.artists (id) on delete cascade,
  year integer not null,
  genre text not null default '',
  release_type text not null check (release_type in ('album', 'ep', 'compilation')),
  cover_color text not null default '#333333',
  cover_url text,
  tracks jsonb not null default '[]'::jsonb,
  avg_rating numeric(2, 1) not null default 0,
  rating_count integer not null default 0,
  spotify_id text
);

create table if not exists public.reviews (
  id text primary key,
  album_id text not null references public.albums (id) on delete cascade,
  album_title text not null,
  artist_id text not null references public.artists (id) on delete cascade,
  username text not null,
  rating numeric(2, 1) not null,
  body text not null default '',
  created_at date not null default current_date
);

alter table public.artists enable row level security;
alter table public.albums enable row level security;
alter table public.reviews enable row level security;

create policy "artists are viewable by everyone"
  on public.artists for select using (true);

create policy "albums are viewable by everyone"
  on public.albums for select using (true);

create policy "reviews are viewable by everyone"
  on public.reviews for select using (true);

-- 同期キュー（supabase/migrations/add_artist_sync_queue.sql 参照）
-- ユーザー評価（supabase/migrations/add_user_ratings.sql 参照）
-- スレッド（supabase/migrations/add_discussion_threads.sql 参照）
-- スレッドの返信ツリー（supabase/migrations/add_post_replies.sql 参照）
-- 投票（supabase/migrations/add_discussion_polls.sql 参照）
-- 参加者による選択肢追加（supabase/migrations/add_poll_option_by_participants.sql 参照）
-- 結果閲覧用選択肢（supabase/migrations/add_poll_view_only_options.sql 参照）
-- 投票選択肢のアルバム／アーティスト参照（supabase/migrations/add_poll_option_references.sql 参照）
-- 閲覧数（supabase/migrations/add_thread_views.sql 参照）
-- 管理者ロール（supabase/migrations/add_admin_role.sql 参照）
-- 数千組を段階的に取り込むときに使用

-- データ投入は npm run sync:spotify:queue または enqueue:artists を使用
