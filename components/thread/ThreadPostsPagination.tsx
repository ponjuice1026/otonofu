import Link from "next/link";
import {
  POSTS_PAGE_SIZE,
  totalPostsPages,
} from "@/lib/threads/posts-pagination";

type ThreadPostsPaginationProps = {
  threadId: string;
  currentPage: number;
  /** ルート（親なし）レス総数。ページの分母。 */
  rootPostCount: number;
  pageSize?: number;
};

/**
 * スレ詳細のレス用ページャ。ルートレス単位でページを切る（返信ツリーは
 * ページ内で完結）。1ページ目は ?page を付けない。#comments へアンカーする。
 */
export function ThreadPostsPagination({
  threadId,
  currentPage,
  rootPostCount,
  pageSize = POSTS_PAGE_SIZE,
}: ThreadPostsPaginationProps) {
  const totalPages = totalPostsPages(rootPostCount, pageSize);
  if (totalPages <= 1) return null;

  const prevPage = currentPage > 1 ? currentPage - 1 : null;
  const nextPage = currentPage < totalPages ? currentPage + 1 : null;

  const hrefFor = (page: number) =>
    page === 1
      ? `/threads/${threadId}#comments`
      : `/threads/${threadId}?page=${page}#comments`;

  return (
    <nav
      className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm"
      aria-label="コメントのページネーション"
    >
      <div className="text-zinc-500">
        {rootPostCount.toLocaleString("ja-JP")} 件のコメント
      </div>
      <div className="flex items-center gap-2">
        {prevPage ? (
          <Link href={hrefFor(prevPage)} className="btn-ghost">
            ← 前へ
          </Link>
        ) : (
          <span className="btn-ghost cursor-not-allowed opacity-40">← 前へ</span>
        )}
        <span className="px-2 text-zinc-400">
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
