import Link from "next/link";
import { AlbumPagination } from "@/components/album/AlbumPagination";
import { getUser } from "@/lib/auth/session";
import {
  PUBLIC_LISTS_PAGE_SIZE,
  getPublicListsCount,
  getPublicListsPage,
} from "@/lib/data/lists";
import { ListCoverCollage } from "@/components/list/ListCoverCollage";
import { UserLink } from "@/components/user/UserLink";
import { pageTitle } from "@/lib/site";

export const metadata = {
  title: pageTitle("リスト"),
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    page?: string;
  }>;
};

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

function listsPageHref(page: number): string {
  return page === 1 ? "/lists" : `/lists?page=${page}`;
}

export default async function ListsPage({ searchParams }: PageProps) {
  const { page: pageParam } = await searchParams;
  const page = parsePage(pageParam);

  const [lists, totalCount, user] = await Promise.all([
    getPublicListsPage(page),
    getPublicListsCount(),
    getUser(),
  ]);

  return (
    <div className="page-shell">
      <header className="page-header flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">リスト</h1>
          <p className="page-desc">
            ユーザーが作ったアルバムリスト
            {totalCount > 0 && (
              <span className="text-neutral-500">
                {" "}
                · 全{totalCount.toLocaleString("ja-JP")}件
              </span>
            )}
          </p>
        </div>
        {user ? (
          <Link href="/lists/new" className="btn-primary shrink-0">
            リストを作る
          </Link>
        ) : (
          <Link
            href="/login?redirect=/lists/new"
            className="btn-secondary shrink-0"
          >
            ログインして作る
          </Link>
        )}
      </header>

      {lists.length > 0 ? (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lists.map((list) => (
              <Link
                key={list.id}
                href={`/lists/${list.id}`}
                className="card-interactive flex gap-4 p-4"
              >
                <div className="w-24 shrink-0">
                  <ListCoverCollage items={list.coverItems} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="line-clamp-2 font-semibold text-neutral-100">
                    {list.title}
                  </h2>
                  <p className="mt-1 text-xs text-neutral-500">
                    <UserLink
                      userId={list.authorId}
                      name={list.authorName}
                      className="text-neutral-400 hover:underline"
                    />
                    {" · "}
                    {list.itemCount.toLocaleString("ja-JP")} 枚
                  </p>
                  {list.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-neutral-500">
                      {list.description}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </section>
          <AlbumPagination
            currentPage={page}
            totalCount={totalCount}
            pageSize={PUBLIC_LISTS_PAGE_SIZE}
            hrefForPage={listsPageHref}
          />
        </>
      ) : (
        <section>
          <p className="page-desc">
            {page > 1
              ? "このページに表示できるリストはありません。"
              : "まだ公開リストがありません。"}
          </p>
          <p className="mt-4 text-sm">
            {user ? (
              <Link href="/lists/new" className="link-accent hover:underline">
                最初のリストを作る →
              </Link>
            ) : (
              <Link href="/albums" className="link-accent hover:underline">
                アルバムを探す →
              </Link>
            )}
          </p>
        </section>
      )}
    </div>
  );
}
