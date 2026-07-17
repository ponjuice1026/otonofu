import type { Review } from "@/lib/types";

export type ReviewSort = "newest" | "helpful" | "rating";

export const REVIEW_SORT_OPTIONS: { value: ReviewSort; label: string }[] = [
  { value: "newest", label: "新着順" },
  { value: "helpful", label: "参考になった順" },
  { value: "rating", label: "評価が高い順" },
];

export function parseReviewSort(value: string | undefined): ReviewSort {
  if (value === "helpful" || value === "rating") return value;
  return "newest";
}

export function reviewSortLabel(sort: ReviewSort): string {
  return REVIEW_SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "";
}

/**
 * レビュー配列を指定の並び順でソートした新しい配列を返す（破壊的変更なし）。
 * - newest: created_at 新しい順
 * - helpful: good リアクション数の多い順（同数は created_at 新しい順）
 * - rating: rating の高い順（同点は created_at 新しい順）
 *
 * goodCountByReviewId が渡されない場合、helpful は 0 件扱いで created_at 順にフォールバックする。
 */
export function sortReviews(
  reviews: Review[],
  sort: ReviewSort,
  goodCountByReviewId?: Map<string, number>,
): Review[] {
  const byCreatedAtDesc = (a: Review, b: Review) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

  const sorted = [...reviews];

  if (sort === "helpful") {
    sorted.sort((a, b) => {
      const goodsA = goodCountByReviewId?.get(a.id) ?? 0;
      const goodsB = goodCountByReviewId?.get(b.id) ?? 0;
      if (goodsB !== goodsA) return goodsB - goodsA;
      return byCreatedAtDesc(a, b);
    });
    return sorted;
  }

  if (sort === "rating") {
    sorted.sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      return byCreatedAtDesc(a, b);
    });
    return sorted;
  }

  sorted.sort(byCreatedAtDesc);
  return sorted;
}

/** レビューページ番号を 1 以上の整数に正規化する（不正値は 1）。 */
export function parseReviewPage(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

export function reviewsPageHref(
  basePath: string,
  params: { reviewSort?: ReviewSort; reviewPage?: number; hash?: string },
): string {
  const search = new URLSearchParams();

  if (params.reviewSort && params.reviewSort !== "newest") {
    search.set("reviewSort", params.reviewSort);
  }

  // 1 ページ目は省略して URL をきれいに保つ。
  if (params.reviewPage && params.reviewPage > 1) {
    search.set("reviewPage", String(params.reviewPage));
  }

  const query = search.toString();
  const hash = params.hash ? `#${params.hash}` : "";

  return query ? `${basePath}?${query}${hash}` : `${basePath}${hash}`;
}
