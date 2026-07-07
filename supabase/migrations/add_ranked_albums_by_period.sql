-- 期間別ランキングのSQL集計化 + ベイズ加重平均
-- Supabase Dashboard → SQL Editor で実行
--
-- 背景:
--   lib/data/albums.ts の getTopRatedAlbumsByReviewPeriod は、期間内の
--   reviews (album_id, rating) を全行フェッチして JS 側で group by 相当の
--   集計をしていた。レビュー数万件になると全件転送がボトルネックになり破綻する。
--
-- 対策:
--   期間内の reviews を album_id で group by し、avg/count を SQL 側で計算する
--   RPC にする。その期間内の global mean で add_ranked_albums_bayesian.sql と
--   同じ式によりベイズ補正したスコアで order by まで行い、結果だけを返す。
--   album の表示情報(タイトル等)は呼び出し側で albums テーブルから引く
--   (album_id, period_avg, period_count, score のみ返す軽量な戻り値にする)。
--
--   既存踏襲: user_id is not null のレビューのみ対象。

create or replace function public.ranked_albums_by_period(
  period_start timestamptz,
  prior_weight numeric default 10,
  result_limit integer default 50,
  sort_mode text default 'rating'
)
returns table (
  album_id text,
  period_avg numeric,
  period_count integer,
  score numeric
)
language sql
stable
as $$
  with period_reviews as (
    select
      r.album_id,
      r.rating
    from public.reviews r
    where r.user_id is not null
      and r.created_at >= period_start
  ),
  per_album as (
    select
      pr.album_id,
      avg(pr.rating) as period_avg,
      count(*)::integer as period_count
    from period_reviews pr
    group by pr.album_id
  ),
  global_stats as (
    select coalesce(avg(pr.rating), 0) as global_mean
    from period_reviews pr
  )
  select
    pa.album_id,
    pa.period_avg,
    pa.period_count,
    (
      (pa.period_count * pa.period_avg + greatest(coalesce(prior_weight, 10), 0) * gs.global_mean)
      / nullif(pa.period_count + greatest(coalesce(prior_weight, 10), 0), 0)
    ) as score
  from per_album pa, global_stats gs
  order by
    case when coalesce(sort_mode, 'rating') = 'reviews' then pa.period_count end desc nulls last,
    case when coalesce(sort_mode, 'rating') = 'reviews' then pa.period_avg end desc nulls last,
    case when coalesce(sort_mode, 'rating') <> 'reviews' then
      (
        (pa.period_count * pa.period_avg + greatest(coalesce(prior_weight, 10), 0) * gs.global_mean)
        / nullif(pa.period_count + greatest(coalesce(prior_weight, 10), 0), 0)
      )
    end desc nulls last,
    case when coalesce(sort_mode, 'rating') <> 'reviews' then pa.period_count end desc nulls last
  limit greatest(1, least(coalesce(result_limit, 50), 500));
$$;

grant execute on function public.ranked_albums_by_period(timestamptz, numeric, integer, text)
  to anon, authenticated;
