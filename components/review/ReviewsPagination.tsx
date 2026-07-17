import Link from "next/link";
import { REVIEWS_PAGE_SIZE } from "@/lib/data/reviews";
import { reviewsPageHref, type ReviewSort } from "@/lib/reviews/review-sort";

type ReviewsPaginationProps = {
  albumId: string;
  currentPage: number;
  totalCount: number;
  sort: ReviewSort;
  pageSize?: number;
};

/**
 * アルバム詳細「みんなのレビュー」のページャ。
 * reviewSort を保持しつつ reviewPage を切り替え、#reviews へアンカーする。
 */
export function ReviewsPagination({
  albumId,
  currentPage,
  totalCount,
  sort,
  pageSize = REVIEWS_PAGE_SIZE,
}: ReviewsPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalPages <= 1) return null;

  const basePath = `/albums/${albumId}`;
  const hrefForPage = (page: number) =>
    reviewsPageHref(basePath, {
      reviewSort: sort,
      reviewPage: page,
      hash: "reviews",
    });

  const prevPage = currentPage > 1 ? currentPage - 1 : null;
  const nextPage = currentPage < totalPages ? currentPage + 1 : null;

  return (
    <nav
      className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-6 text-sm"
      aria-label="レビューのページネーション"
    >
      <div className="text-[var(--muted)]">
        {totalCount.toLocaleString("ja-JP")} 件中{" "}
        {((currentPage - 1) * pageSize + 1).toLocaleString("ja-JP")}–
        {Math.min(currentPage * pageSize, totalCount).toLocaleString("ja-JP")} 件
      </div>
      <div className="flex items-center gap-2">
        {prevPage ? (
          <Link href={hrefForPage(prevPage)} scroll={false} className="btn-ghost">
            ← 前へ
          </Link>
        ) : (
          <span className="btn-ghost cursor-not-allowed opacity-40">← 前へ</span>
        )}
        <span className="px-2 text-[var(--muted)]">
          {currentPage} / {totalPages}
        </span>
        {nextPage ? (
          <Link href={hrefForPage(nextPage)} scroll={false} className="btn-ghost">
            次へ →
          </Link>
        ) : (
          <span className="btn-ghost cursor-not-allowed opacity-40">次へ →</span>
        )}
      </div>
    </nav>
  );
}
