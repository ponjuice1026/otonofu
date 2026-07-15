/**
 * `unstable_cache` のタグと再検証秒数を一元管理する。
 *
 * キャッシュを持つデータ取得関数と、それを無効化するミューテーション
 * （server actions）が同じ定数を参照することで、タグのズレを防ぐ。
 */
export const CACHE_TAGS = {
  /** アルバム本体・カバー・評価集計（ランキング/おすすめ含む） */
  albums: "albums",
  /** アーティスト名・メタ情報 */
  artists: "artists",
  /** レビュー（話題/新着の集計） */
  reviews: "reviews",
  /** スレッド（話題/新着の集計） */
  threads: "threads",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

/**
 * 再検証間隔（秒）。
 * - lookup: 名前・カバーなど滅多に変わらない参照データ
 * - feed: ランキング・話題など、頻繁に更新されるが数十秒の遅延は許容できる集計
 */
export const CACHE_REVALIDATE = {
  /** 参照データ（アルバムカバー・アーティスト名など） */
  lookup: 3600,
  /** 集計フィード（ランキング・話題・新着） */
  feed: 120,
} as const;
