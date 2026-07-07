import Link from "next/link";
import { THREADS_PAGE_SIZE } from "@/lib/data/threads";

type ThreadPaginationProps = {
  currentPage: number;
  totalCount: number;
  pageSize?: number;
  /** 現在の絞り込みカテゴリ slug。ページ遷移時も維持する。 */
  categorySlug?: string;
};

export function ThreadPagination({
  currentPage,
  totalCount,
  pageSize = THREADS_PAGE_SIZE,
  categorySlug,
}: ThreadPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalPages <= 1) return null;

  const prevPage = currentPage > 1 ? currentPage - 1 : null;
  const nextPage = currentPage < totalPages ? currentPage + 1 : null;

  const hrefFor = (page: number) => {
    const params = new URLSearchParams();
    if (categorySlug) params.set("category", categorySlug);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return query ? `/threads?${query}` : "/threads";
  };

  return (
    <nav
      className="mt-8 flex flex-wrap items-center justify-between gap-3 text-sm"
      aria-label="ページネーション"
    >
      <div className="text-neutral-500">
        {totalCount.toLocaleString("ja-JP")} 件中{" "}
        {((currentPage - 1) * pageSize + 1).toLocaleString("ja-JP")}–
        {Math.min(currentPage * pageSize, totalCount).toLocaleString("ja-JP")} 件
      </div>
      <div className="flex items-center gap-2">
        {prevPage ? (
          <Link href={hrefFor(prevPage)} className="btn-ghost">
            ← 前へ
          </Link>
        ) : (
          <span className="btn-ghost cursor-not-allowed opacity-40">← 前へ</span>
        )}
        <span className="px-2 text-neutral-400">
          {currentPage} / {totalPages}
        </span>
        {nextPage ? (
          <Link href={hrefFor(nextPage)} className="btn-ghost">
            次へ →
          </Link>
        ) : (
          <span className="btn-ghost cursor-not-allowed opacity-40">次へ →</span>
        )}
      </div>
    </nav>
  );
}
