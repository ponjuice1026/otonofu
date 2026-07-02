import Link from "next/link";
import { ALBUMS_PAGE_SIZE } from "@/lib/data/albums";

type AlbumPaginationProps = {
  currentPage: number;
  totalCount: number;
  pageSize?: number;
  hrefForPage?: (page: number) => string;
};

export function AlbumPagination({
  currentPage,
  totalCount,
  pageSize = ALBUMS_PAGE_SIZE,
  hrefForPage = (page) => (page === 1 ? "/albums" : `/albums?page=${page}`),
}: AlbumPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalPages <= 1) return null;

  const prevPage = currentPage > 1 ? currentPage - 1 : null;
  const nextPage = currentPage < totalPages ? currentPage + 1 : null;

  return (
    <nav
      className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-6 text-sm"
      aria-label="ページネーション"
    >
      <div className="text-neutral-500">
        {totalCount.toLocaleString("ja-JP")} 件中{" "}
        {((currentPage - 1) * pageSize + 1).toLocaleString("ja-JP")}–
        {Math.min(currentPage * pageSize, totalCount).toLocaleString("ja-JP")} 件
      </div>
      <div className="flex items-center gap-2">
        {prevPage ? (
          <Link href={hrefForPage(prevPage)} className="btn-ghost">
            ← 前へ
          </Link>
        ) : (
          <span className="btn-ghost cursor-not-allowed opacity-40">← 前へ</span>
        )}
        <span className="px-2 text-neutral-400">
          {currentPage} / {totalPages}
        </span>
        {nextPage ? (
          <Link href={hrefForPage(nextPage)} className="btn-ghost">
            次へ →
          </Link>
        ) : (
          <span className="btn-ghost cursor-not-allowed opacity-40">次へ →</span>
        )}
      </div>
    </nav>
  );
}
