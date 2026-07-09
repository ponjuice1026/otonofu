-- reviews.created_at を date → timestamptz に変更（時刻精度の向上）
-- Supabase Dashboard → SQL Editor で実行
--
-- 背景: 現状 reviews.created_at は date（日単位）で、同じ日に投稿された
-- レビュー同士の前後関係が失われ、並び順（新着順）やトレンド計算が不正確になる。
-- timestamptz に変更し、以後は挿入時刻を秒単位まで保持する。
--
-- 影響:
--   - 既存行の date 値は「その日の 00:00:00（セッションのタイムゾーン、通常UTC）」として
--     そのまま timestamptz に変換される（using created_at::timestamptz）。
--     これにより既存レビューの相対順序は変わらない（同日内の前後関係は元々無かったため）。
--   - 以後の新規行は now()（挿入時刻）が入る。
--   - lib/data/reviews.ts, lib/data/albums.ts, lib/data/search.ts など
--     created_at を order/gte で使う箇所は文字列比較ではなく DB 側の timestamptz 比較になるため、
--     従来どおり正しく動く（date → timestamptz への型変更は既存クエリに影響しない）。

alter table public.reviews
  alter column created_at type timestamptz using created_at::timestamptz;

alter table public.reviews
  alter column created_at set default now();

-- 新着順 / 期間フィルタ（getRecentReviews, getTrendingReviews,
-- getTopRatedAlbumsByReviewPeriodViaScan 等）の order by / gte 用インデックス。
create index if not exists reviews_created_at_idx
  on public.reviews (created_at desc);
