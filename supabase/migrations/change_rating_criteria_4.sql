-- 評価要素を4項目（歌詞・音楽性・雰囲気・革新性）に変更
-- スケールは 0〜10。何度実行しても OK（idempotent）
-- Supabase Dashboard → SQL Editor で実行してください
--
-- ・rating_lyrics / rating_atmosphere は既存カラムを継続利用
-- ・rating_musicality（音楽性）/ rating_innovation（革新性）を新規追加
-- ・旧カラム（rating_melody / rating_performance / rating_completion）は
--   削除せず残す（過去データ保全のため）。アプリ側は参照しません。

-- 1. 新カラム追加（0〜10、制約付き）
alter table public.reviews
  add column if not exists rating_musicality numeric(4, 1),
  add column if not exists rating_innovation numeric(4, 1);

-- lyrics / atmosphere が未作成の環境向けの保険
alter table public.reviews
  add column if not exists rating_lyrics numeric(4, 1),
  add column if not exists rating_atmosphere numeric(4, 1);

-- 2. 旧データからの補完（新カラムが空のレビューのみ）
--    音楽性 = メロディと演奏技術の平均、革新性 = 完成度 で近似
do $$
declare
  has_melody boolean;
  has_perf boolean;
  has_completion boolean;
begin
  select exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reviews'
      and column_name = 'rating_melody') into has_melody;
  select exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reviews'
      and column_name = 'rating_performance') into has_perf;
  select exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reviews'
      and column_name = 'rating_completion') into has_completion;

  if has_melody and has_perf then
    update public.reviews
    set rating_musicality = round(((coalesce(rating_melody, rating) + coalesce(rating_performance, rating)) / 2.0)::numeric, 1)
    where rating_musicality is null;
  else
    update public.reviews
    set rating_musicality = rating
    where rating_musicality is null and rating is not null;
  end if;

  if has_completion then
    update public.reviews
    set rating_innovation = coalesce(rating_completion, rating)
    where rating_innovation is null;
  else
    update public.reviews
    set rating_innovation = rating
    where rating_innovation is null and rating is not null;
  end if;
end $$;

-- 3. 0〜10 の制約を付与
alter table public.reviews drop constraint if exists reviews_rating_musicality_check;
alter table public.reviews drop constraint if exists reviews_rating_innovation_check;
alter table public.reviews
  add constraint reviews_rating_musicality_check
    check (rating_musicality is null or (rating_musicality >= 0 and rating_musicality <= 10)),
  add constraint reviews_rating_innovation_check
    check (rating_innovation is null or (rating_innovation >= 0 and rating_innovation <= 10));
