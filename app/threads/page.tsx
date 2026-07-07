import Link from "next/link";
import { ThreadPagination } from "@/components/thread/ThreadPagination";
import { ThreadCategoryNav } from "@/components/thread/ThreadCategoryNav";
import { TrendingThreadList } from "@/components/thread/TrendingThreadList";
import { formatThreadDate } from "@/lib/threads/format";
import {
  THREADS_PAGE_SIZE,
  getDiscussionThreadCount,
  getDiscussionThreadsPage,
  getFeaturedThreads,
  getThreadCategories,
  getTrendingThreads,
} from "@/lib/data/threads";
import { getUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { pageTitle } from "@/lib/site";

export const metadata = {
  title: pageTitle("セッション"),
  description:
    "アルバムやアーティストについて語り合う、オトノフのメインセッション一覧。",
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ page?: string; category?: string }>;
};

export default async function ThreadsPage({ searchParams }: PageProps) {
  const { page: pageParam, category: categoryParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const categorySlug = categoryParam?.trim() || undefined;

  const [
    newestThreads,
    totalCount,
    user,
    trendingThreads,
    featuredThreads,
    categories,
  ] = await Promise.all([
    getDiscussionThreadsPage(page, THREADS_PAGE_SIZE, "newest", categorySlug),
    getDiscussionThreadCount(categorySlug),
    getUser(),
    getTrendingThreads(8),
    getFeaturedThreads(6),
    getThreadCategories(),
  ]);

  const activeCategory = categorySlug
    ? categories.find((c) => c.slug === categorySlug) ?? null
    : null;

  return (
    <div className="page-shell">
      <header className="page-header">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="home-hero__eyebrow mb-2">Main Feature</p>
            <h1 className="page-title">セッション</h1>
            <p className="page-desc">
              音楽について語り合う、オトノフの中心。セッションを立てて、誰でも参加できます。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {user ? (
              <Link href="/threads/new" className="btn-primary">
                ＋ セッションを作成
              </Link>
            ) : (
              <Link href="/login?redirect=/threads/new" className="btn-secondary">
                ログインしてセッションを作成
              </Link>
            )}
          </div>
        </div>
      </header>

      {!isSupabaseConfigured() && (
        <p className="alert alert-warning mb-8">
          Supabase 未設定のため、セッション機能は利用できません。
        </p>
      )}

      {featuredThreads.length > 0 && (
        <section className="mb-14">
          <div className="section-header">
            <div>
              <h2 className="section-title section-title-accent section-accent-violet">
                運営ピックアップ
              </h2>
              <p className="section-desc">
                編集部が選ぶ、いま読んでほしい話題
              </p>
            </div>
          </div>
          <TrendingThreadList
            threads={featuredThreads}
            layout="row"
            showNote
            showRank={false}
          />
        </section>
      )}

      <section className="mb-14">
        <div className="section-header">
          <div>
            <h2 className="section-title section-title-accent section-accent-violet">
              いま一番ホット
            </h2>
            <p className="section-desc">直近で最も盛り上がっている話題</p>
          </div>
        </div>
        <TrendingThreadList threads={trendingThreads} layout="row" />
      </section>

      <section>
        <div className="section-header">
          <div>
            <h2 className="section-title section-title-accent section-accent-violet">
              {activeCategory ? activeCategory.name : "すべてのセッション"}
            </h2>
            <p className="section-desc">
              {totalCount.toLocaleString("ja-JP")} 件 · 作成日時の新しい順
            </p>
          </div>
        </div>

        <ThreadCategoryNav
          categories={categories}
          activeSlug={activeCategory?.slug ?? null}
        />

        {newestThreads.length === 0 ? (
          <div className="empty-state py-10">
            {activeCategory
              ? "このカテゴリにはまだセッションがありません。"
              : "まだセッションがありません。"}
          </div>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {newestThreads.map((thread) => (
                <li key={thread.id}>
                  <Link
                    href={`/threads/${thread.id}`}
                    className="card-interactive block px-4 py-4"
                  >
                    <h3 className="font-semibold text-neutral-100">
                      {thread.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-sm text-neutral-500">
                      {thread.body}
                    </p>
                    <p className="mt-3 text-xs text-neutral-500">
                      作成: {thread.authorName}
                      {thread.categoryName && (
                        <span className="badge badge-muted ml-2">
                          {thread.categoryName}
                        </span>
                      )}
                      <span
                        className={
                          thread.kind === "album"
                            ? "badge badge-muted ml-2"
                            : "badge ml-2"
                        }
                      >
                        {thread.kind === "album" ? "アルバム" : "議論"}
                      </span>
                      {thread.hasPoll && (
                        <span className="badge ml-2">投票あり</span>
                      )}{" "}
                      · 閲覧 {thread.viewCount.toLocaleString("ja-JP")} · 返信{" "}
                      {thread.postCount} · 作成{" "}
                      {formatThreadDate(thread.createdAt)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>

            <ThreadPagination
              currentPage={page}
              totalCount={totalCount}
              categorySlug={categorySlug}
            />
          </>
        )}
      </section>
    </div>
  );
}
