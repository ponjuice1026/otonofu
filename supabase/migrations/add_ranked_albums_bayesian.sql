-- ランキングのベイズ加重平均化（全期間）
-- Supabase Dashboard → SQL Editor で実行
--
-- 背景:
--   albums.avg_rating は refresh_album_rating による単純平均。
--   評価が1件でも満点なら、評価数十件で高評価のアルバムより上位に来てしまい、
--   RYM型サイトの信頼性の核であるランキングの質が崩壊する。
--
-- 対策:
--   IMDb/RYM 型のベイズ推定でランキングのみ補正する。
--     score = (v * R + m * C) / (v + m)
--     v = そのアルバムの評価数 (rating_count)
--     R = そのアルバムの平均評価 (avg_rating)
--     C = 全アルバム(評価が付いているもの)の平均評価
--     m = 事前の重み(信頼に足る評価数の目安。既定 10。lib/albums/bayesian.ts の
--         BAYESIAN_PRIOR_WEIGHT と一致させること)
--
--   avg_rating 自体は生の単純平均のまま変更しない（個別ページ表示用）。
--   並び替えのみ RPC 側でベイズスコアを計算して行う。
--
--   全件フェッチしてJSで集計していた処理を、SQL側の1クエリに寄せることで
--   レビュー数万件でも破綻しないようにする（getTopRatedAlbums 相当）。
--
-- 戻り値: albums の全表示列 + bayesian_score。
-- sort_mode: 'rating' はベイズスコア降順、'reviews' は rating_count 降順。

create or replace function public.ranked_albums_bayesian(
  prior_weight numeric default 10,
  result_limit integer default 50,
  sort_mode text default 'rating'
)
returns table (
  id text,
  title text,
  artist_id text,
  spotify_id text,
  year integer,
  genre text,
  release_type text,
  cover_color text,
  cover_url text,
  avg_rating numeric,
  rating_count integer,
  bayesian_score numeric
)
language sql
stable
as $$
  with global_stats as (
    select coalesce(avg(a.avg_rating), 0) as global_mean
    from public.albums a
    where a.rating_count > 0
  )
  select
    a.id,
    a.title,
    a.artist_id,
    a.spotify_id,
    a.year,
    a.genre,
    a.release_type,
    a.cover_color,
    a.cover_url,
    a.avg_rating,
    a.rating_count,
    (
      (a.rating_count * a.avg_rating + greatest(coalesce(prior_weight, 10), 0) * gs.global_mean)
      / nullif(a.rating_count + greatest(coalesce(prior_weight, 10), 0), 0)
    ) as bayesian_score
  from public.albums a, global_stats gs
  where a.rating_count > 0
  order by
    case when coalesce(sort_mode, 'rating') = 'reviews' then a.rating_count end desc nulls last,
    case when coalesce(sort_mode, 'rating') = 'reviews' then a.avg_rating end desc nulls last,
    case when coalesce(sort_mode, 'rating') <> 'reviews' then
      (
        (a.rating_count * a.avg_rating + greatest(coalesce(prior_weight, 10), 0) * gs.global_mean)
        / nullif(a.rating_count + greatest(coalesce(prior_weight, 10), 0), 0)
      )
    end desc nulls last,
    case when coalesce(sort_mode, 'rating') <> 'reviews' then a.rating_count end desc nulls last
  limit greatest(1, least(coalesce(result_limit, 50), 500));
$$;

grant execute on function public.ranked_albums_bayesian(numeric, integer, text)
  to anon, authenticated;
