-- 評価データをすべてリセット
-- Supabase Dashboard → SQL Editor で実行

delete from public.reviews;

update public.albums
set
  avg_rating = 0,
  rating_count = 0;
