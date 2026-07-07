-- 運営ピックアップ（手動一押し）
-- Supabase Dashboard → SQL Editor で実行

alter table public.discussion_threads
  add column if not exists featured_rank integer,   -- null=非ピック。小さいほど上位（0が最上位）
  add column if not exists featured_note text
    check (featured_note is null or char_length(featured_note) <= 80),
  add column if not exists featured_at timestamptz;

-- ピック済みの取得用（published のみ、rank 昇順）
create index if not exists discussion_threads_featured_idx
  on public.discussion_threads (featured_rank asc)
  where featured_rank is not null;
