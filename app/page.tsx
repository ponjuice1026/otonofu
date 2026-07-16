import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { AlbumRankingList } from "@/components/album/AlbumRankingList";
import { ReviewCard } from "@/components/review/ReviewCard";
import { HomeThreadFeed } from "@/components/thread/HomeThreadFeed";
import { FollowingReviewsSection } from "@/components/home/FollowingReviewsSection";
import { RecommendedAlbumsSection } from "@/components/home/RecommendedAlbumsSection";
import { RecommendedThreadsSection } from "@/components/home/RecommendedThreadsSection";
import { SectionSkeleton } from "@/components/home/SectionSkeleton";
import { buildReviewCardCoverProps } from "@/lib/reviews/review-card-cover";
import { getUser } from "@/lib/auth/session";
import { getAlbumCoverMapForIds, getTopRatedAlbums } from "@/lib/data/albums";
import { getArtistNameMapForIds } from "@/lib/data/artists";
import { getReviewReactionStates } from "@/lib/data/reactions";
import { getReviewCommentCounts } from "@/lib/data/review-comments";
import {
  getRecentReviews,
  getReviewSessionsForThreads,
  getTrendingReviews,
} from "@/lib/data/reviews";
import {
  getDiscussionThreadsPage,
  getTrendingThreads,
} from "@/lib/data/threads";
import {
  HOME_TRENDING_POOL_SIZE,
  pickHomeTrendingThreadFeed,
} from "@/lib/threads/home-feed";
import {
  pageTitle,
  siteUrl,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site";

export const metadata = {
  alternates: { canonical: siteUrl("/") },
  openGraph: {
    title: pageTitle(),
    description: SITE_DESCRIPTION,
    url: SITE_URL,
  },
};

const homeJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  inLanguage: "ja-JP",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: siteUrl("/search?q={search_term_string}"),
    },
    "query-input": "required name=search_term_string",
  },
};

export const dynamic = "force-dynamic";

type FeedMode = "trending" | "newest";

type HomeProps = {
  searchParams: Promise<{ reviews?: string; threads?: string }>;
};

const HOME_THREADS_LIMIT = 5;

function parseFeedMode(value: string | undefined): FeedMode {
  return value === "newest" ? "newest" : "trending";
}

function homeHref(
  modes: { threads: FeedMode; reviews: FeedMode },
  patch: Partial<{ threads: FeedMode; reviews: FeedMode }>,
  hash?: string,
): string {
  const threads = patch.threads ?? modes.threads;
  const reviews = patch.reviews ?? modes.reviews;
  const params = new URLSearchParams();

  if (threads === "newest") params.set("threads", "newest");
  if (reviews === "newest") params.set("reviews", "newest");

  const query = params.toString();
  const hashPart = hash ? `#${hash}` : "";

  return query ? `/?${query}${hashPart}` : `/${hashPart}`;
}

export default async function Home({ searchParams }: HomeProps) {
  const { reviews: reviewsParam, threads: threadsParam } = await searchParams;
  const reviewMode = parseFeedMode(reviewsParam);
  const threadMode = parseFeedMode(threadsParam);
  const feedModes = { threads: threadMode, reviews: reviewMode };

  // ブロッキング描画は全ユーザー共通の「公開・キャッシュ済み」フィードだけに絞る。
  // ユーザー個別のセクション（おすすめセッション・フォロー中レビュー・
  // おすすめアルバム）は下部で <Suspense> ストリームさせ、初期描画を待たせない。
  const user = await getUser();

  const [ranked, homeReviews, homeThreads] = await Promise.all([
    getTopRatedAlbums(10),
    reviewMode === "newest" ? getRecentReviews(6) : getTrendingReviews(6),
    threadMode === "newest"
      ? getDiscussionThreadsPage(1, HOME_THREADS_LIMIT, "newest")
      : getTrendingThreads(HOME_TRENDING_POOL_SIZE),
  ]);

  const rankedIds = ranked.map((album) => album.id);

  const allSessionReviews = await getReviewSessionsForThreads(homeThreads, {
    cachedReviews: homeReviews,
  });

  const sessionReviewByThreadId = new Map(
    allSessionReviews
      .filter((review) => review.threadId)
      .map((review) => [review.threadId!, review]),
  );
  const sessionReviewThreads = homeThreads
    .map((thread) => sessionReviewByThreadId.get(thread.id))
    .filter((review): review is NonNullable<typeof review> => Boolean(review));

  const homeThreadFeed =
    threadMode === "trending"
      ? pickHomeTrendingThreadFeed(homeThreads, sessionReviewByThreadId)
      : {
          reviewSessions: sessionReviewThreads,
          regularThreads: homeThreads.filter(
            (thread) => !sessionReviewByThreadId.has(thread.id),
          ),
        };

  const standaloneReviews = homeReviews.filter((review) => !review.threadId);

  const allFeedReviewIds = [
    ...new Set([
      ...standaloneReviews.map((review) => review.id),
      ...homeThreadFeed.reviewSessions.map((review) => review.id),
    ]),
  ];
  const reviewAlbumIds = [
    ...new Set([
      ...standaloneReviews.map((review) => review.albumId),
      ...homeThreadFeed.reviewSessions.map((review) => review.albumId),
      ...homeThreadFeed.regularThreads
        .map((thread) => thread.albumId)
        .filter((id): id is string => Boolean(id)),
    ]),
  ];
  // ランキング欄のアーティスト名だけが必要（レビューカードは artistName 非依存）。
  const artistIds = [...new Set(ranked.map((album) => album.artistId))];

  const [reviewReactions, reviewCommentCounts, artistNames, albumCovers] =
    await Promise.all([
      getReviewReactionStates(allFeedReviewIds),
      getReviewCommentCounts(allFeedReviewIds),
      getArtistNameMapForIds(artistIds),
      getAlbumCoverMapForIds(reviewAlbumIds),
    ]);

  // おすすめセッションはトレンド欄で表示済みのスレを除外して重複を防ぐ。
  const shownThreadIds = homeThreads.map((thread) => thread.id);

  return (
    <div className="page-shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
      />
      <section className="home-hero">
        <div className="home-hero__inner">
          <div className="home-hero__icon-wrap">
            <div className="home-hero__icon-glow" />
            <Image
              src="/brand/otonofu-icon.png?v=3"
              alt=""
              width={88}
              height={88}
              unoptimized
              priority
              className="home-hero__icon"
            />
          </div>
          <div>
            <p className="home-hero__eyebrow">Music Threads</p>
            <h1 className="home-hero__title">音楽のセッションは、ここから。</h1>
            <p className="home-hero__desc">
              アルバムもアーティストも、好きな切り口で語れる。オトノフはセッションを中心に、レビューと評価も楽しめる場所です。
            </p>
            <p className="home-hero__features">
              セッション · 投票 · 匿名で参加
            </p>
            <div className="home-hero__actions">
              <Link href="/threads" className="btn-primary">
                セッションを見る
              </Link>
              {user ? (
                <Link href="/threads/new" className="btn-secondary">
                  ＋ セッションを作成
                </Link>
              ) : (
                <Link href="/login?redirect=/threads/new" className="btn-secondary">
                  ログインしてセッションを作成
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="home-section mb-14">
        <div className="section-header">
          <div>
            <h2 className="section-title section-title-accent section-accent-violet">
              {threadMode === "newest" ? "新着のセッション" : "いま話題のセッション"}
            </h2>
            <p className="section-desc">
              {threadMode === "newest"
                ? "作成日時の新しい順"
                : "いまオトノフで盛り上がっているセッション"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="tab-group">
              <Link
                href={homeHref(feedModes, { threads: "trending" }, "threads")}
                scroll={false}
                prefetch={false}
                aria-current={threadMode === "trending" ? "page" : undefined}
                className={
                  threadMode === "trending"
                    ? "tab-item tab-item-active"
                    : "tab-item"
                }
              >
                話題
              </Link>
              <Link
                href={homeHref(feedModes, { threads: "newest" }, "threads")}
                scroll={false}
                prefetch={false}
                aria-current={threadMode === "newest" ? "page" : undefined}
                className={
                  threadMode === "newest"
                    ? "tab-item tab-item-active"
                    : "tab-item"
                }
              >
                新着
              </Link>
            </div>
            <Link href="/threads" className="link-accent hover:underline">
              すべて見る →
            </Link>
          </div>
        </div>
        <div id="threads" className="scroll-mt-8">
          <HomeThreadFeed
            threads={homeThreadFeed.regularThreads}
            reviewSessions={homeThreadFeed.reviewSessions}
            variant={threadMode}
            layout="row"
            albumCovers={albumCovers}
            reviewReactions={reviewReactions}
            reviewCommentCounts={reviewCommentCounts}
          />
        </div>
      </section>

      {user && (
        <Suspense fallback={<SectionSkeleton cards={3} layout="row" />}>
          <RecommendedThreadsSection
            userId={user.id}
            excludeThreadIds={shownThreadIds}
          />
        </Suspense>
      )}

      {user && (
        <Suspense fallback={<SectionSkeleton cards={2} layout="row" />}>
          <FollowingReviewsSection userId={user.id} />
        </Suspense>
      )}

      <div className="home-secondary">
        <div className="home-secondary__header">
          <h2 className="home-secondary__title">レビュー・評価</h2>
          <p className="home-secondary__desc">
            セッションで語った感想を、記録として残す
          </p>
        </div>

      <section className="home-section mb-14">
        <div className="section-header">
          <div>
            <h2 className="section-title section-title-accent section-accent-amber">
              {reviewMode === "newest" ? "新着レビュー" : "話題のレビュー"}
            </h2>
            <p className="section-desc">
              {reviewMode === "newest"
                ? "投稿日時の新しい順"
                : "直近で 👍 を集めているユーザーレビュー"}
            </p>
          </div>
          <div className="tab-group">
            <Link
              href={homeHref(feedModes, { reviews: "trending" }, "reviews")}
              scroll={false}
              prefetch={false}
              aria-current={reviewMode === "trending" ? "page" : undefined}
              className={
                reviewMode === "trending" ? "tab-item tab-item-active" : "tab-item"
              }
            >
              話題
            </Link>
            <Link
              href={homeHref(feedModes, { reviews: "newest" }, "reviews")}
              scroll={false}
              prefetch={false}
              aria-current={reviewMode === "newest" ? "page" : undefined}
              className={
                reviewMode === "newest" ? "tab-item tab-item-active" : "tab-item"
              }
            >
              新着
            </Link>
          </div>
        </div>
        <div id="reviews" className="scroll-mt-8">
          {standaloneReviews.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {standaloneReviews.map((review) => {
                const { albumCoverUrl, albumCoverColor } = buildReviewCardCoverProps(
                  review.albumId,
                  albumCovers,
                );

                return (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    showAlbumCover
                    albumCoverUrl={albumCoverUrl}
                    albumCoverColor={albumCoverColor}
                    reactionState={reviewReactions.get(review.id)}
                    commentCount={reviewCommentCounts.get(review.id) ?? 0}
                  />
                );
              })}
            </div>
          ) : (
            <p className="empty-state">
              {reviewMode === "trending"
                ? "直近で話題のレビューはまだありません。"
                : "まだレビューがありません。"}
            </p>
          )}
        </div>
      </section>

      <section className="home-section mb-14">
        <div className="section-header">
          <div>
            <h2 className="section-title section-title-accent section-accent-cyan">
              評価ランキング
            </h2>
            <p className="section-desc">ユーザー評価の高いアルバム</p>
          </div>
          <Link href="/charts" className="link-accent hover:underline">
            すべて見る →
          </Link>
        </div>
        <AlbumRankingList albums={ranked} artistNames={artistNames} />
      </section>

      <Suspense fallback={<SectionSkeleton cards={5} layout="grid" />}>
        <RecommendedAlbumsSection
          userId={user?.id ?? null}
          excludeAlbumIds={rankedIds}
        />
      </Suspense>
      </div>
    </div>
  );
}
