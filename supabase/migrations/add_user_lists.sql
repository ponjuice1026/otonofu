-- ユーザー作成のアルバムリスト（RYM のコア機能）
-- Supabase Dashboard → SQL Editor で実行

create table if not exists public.user_lists (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 100),
  description text check (char_length(description) <= 2000),
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.user_lists (id) on delete cascade,
  album_id text not null references public.albums (id) on delete cascade,
  position integer not null,
  note text check (char_length(note) <= 500),   -- 各アルバムへの一言
  unique (list_id, album_id)
);

create index if not exists user_lists_author_idx
  on public.user_lists (author_id, created_at desc);

create index if not exists user_lists_public_idx
  on public.user_lists (created_at desc)
  where is_public;

create index if not exists user_list_items_list_idx
  on public.user_list_items (list_id, position asc);

alter table public.user_lists enable row level security;
alter table public.user_list_items enable row level security;

-- user_lists: 公開リストは全員 select、非公開は本人のみ
drop policy if exists "public lists are viewable by everyone" on public.user_lists;
create policy "public lists are viewable by everyone"
  on public.user_lists for select
  using (is_public or auth.uid() = author_id);

drop policy if exists "list authors can insert own" on public.user_lists;
create policy "list authors can insert own"
  on public.user_lists for insert
  with check (auth.uid() = author_id);

drop policy if exists "list authors can update own" on public.user_lists;
create policy "list authors can update own"
  on public.user_lists for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists "list authors can delete own" on public.user_lists;
create policy "list authors can delete own"
  on public.user_lists for delete
  using (auth.uid() = author_id);

-- user_list_items: 親リストが閲覧可能なら select、編集は親リストの作者のみ
drop policy if exists "list items follow parent visibility" on public.user_list_items;
create policy "list items follow parent visibility"
  on public.user_list_items for select
  using (
    exists (
      select 1 from public.user_lists l
      where l.id = list_id
        and (l.is_public or l.author_id = auth.uid())
    )
  );

drop policy if exists "list owners can insert items" on public.user_list_items;
create policy "list owners can insert items"
  on public.user_list_items for insert
  with check (
    exists (
      select 1 from public.user_lists l
      where l.id = list_id and l.author_id = auth.uid()
    )
  );

drop policy if exists "list owners can update items" on public.user_list_items;
create policy "list owners can update items"
  on public.user_list_items for update
  using (
    exists (
      select 1 from public.user_lists l
      where l.id = list_id and l.author_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.user_lists l
      where l.id = list_id and l.author_id = auth.uid()
    )
  );

drop policy if exists "list owners can delete items" on public.user_list_items;
create policy "list owners can delete items"
  on public.user_list_items for delete
  using (
    exists (
      select 1 from public.user_lists l
      where l.id = list_id and l.author_id = auth.uid()
    )
  );
