-- アーティスト同期キュー（数千組規模の段階的取り込み用）
-- Supabase Dashboard → SQL Editor で実行

create table if not exists public.artist_sync_queue (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  spotify_id text,
  status text not null default 'pending'
    check (status in ('pending', 'syncing', 'failed', 'done', 'skipped')),
  priority integer not null default 0,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz
);

create unique index if not exists artist_sync_queue_name_unique
  on public.artist_sync_queue (name);

create unique index if not exists artist_sync_queue_spotify_id_unique
  on public.artist_sync_queue (spotify_id)
  where spotify_id is not null;

create index if not exists artist_sync_queue_status_priority_idx
  on public.artist_sync_queue (status, priority desc, created_at asc);

alter table public.artist_sync_queue enable row level security;

-- service_role のみ操作（anon からは見えない）
