/**
 * スレのレス（コメント）ページネーションの純関数ヘルパー。
 *
 * ページング方式: 「ルート（親を持たない）レス単位」でページを切る。
 * 各ルートの子孫（返信ツリー）は同一ページに丸ごと含めるため、
 * 返信ツリー（post-tree.ts）は常にページ内で完結する。
 * これにより「親がページ外」という不整合が起きない。
 */

/** 1ページあたりのルートレス数。 */
export const POSTS_PAGE_SIZE = 100;

/** ページ番号を 1 以上に正規化する。 */
export function normalizePostsPage(page: number): number {
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.floor(page);
}

/** ルートレス総数とページサイズから総ページ数を求める（最低 1）。 */
export function totalPostsPages(
  rootPostCount: number,
  pageSize: number = POSTS_PAGE_SIZE,
): number {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(rootPostCount / pageSize));
}

/**
 * ルートレスの range（Supabase `.range(from, to)` 用）を求める。
 * page は 1 始まり。
 */
export function postsPageRange(
  page: number,
  pageSize: number = POSTS_PAGE_SIZE,
): { from: number; to: number } {
  const safePage = normalizePostsPage(page);
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize - 1;
  return { from, to };
}
