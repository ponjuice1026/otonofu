import Link from "next/link";
import { RecommendedThreadList } from "@/components/thread/RecommendedThreadList";
import { getAlbumCoverMapForIds } from "@/lib/data/albums";
import { getReviewReactionStates } from "@/lib/data/reactions";
import { getReviewCommentCounts } from "@/lib/data/review-comments";
import { getReviewSessionsForThreads } from "@/lib/data/reviews";
import { getRecommendedThreadsForUser } from "@/lib/data/threads";

type Props = {
  userId: string;
  /** すでにトレンド欄で表示済みのスレID（重複表示を避ける） */
  excludeThreadIds: string[];
  limit?: number;
};

/**
 * ホームの「あなたへのおすすめセッション」セクション。
 *
 * getRecommendedThreadsForUser は interest 収集 → poll_options → threads →
 * 著者名と最大数層のウォーターフォールになるため、ここを独立した async
 * サーバコンポーネントに切り出し <Suspense> でストリームさせる。これにより
 * キャッシュ済みの公開フィード（トレンド）の初期描画をブロックしない。
 */
export async function RecommendedThreadsSection({
  userId,
  excludeThreadIds,
  limit = 5,
}: Props) {
  const recommended = await getRecommendedThreadsForUser(userId, limit);
  const exclude = new Set(excludeThreadIds);
  const threads = recommended.filter((thread) => !exclude.has(thread.id));

  if (threads.length === 0) return null;

  const sessionReviews = await getReviewSessionsForThreads(threads);
  const sessionByThreadId = new Map(
    sessionReviews
      .filter((review) => review.threadId)
      .map((review) => [review.threadId!, review]),
  );
  const orderedSessions = threads
    .map((thread) => sessionByThreadId.get(thread.id))
    .filter((review): review is NonNullable<typeof review> => Boolean(review));

  const reviewIds = orderedSessions.map((review) => review.id);
  const albumIds = [
    ...new Set([
      ...threads
        .map((thread) => thread.albumId)
        .filter((id): id is string => Boolean(id)),
      ...orderedSessions.map((review) => review.albumId),
    ]),
  ];

  const [reviewReactions, reviewCommentCounts, albumCovers] = await Promise.all([
    getReviewReactionStates(reviewIds),
    getReviewCommentCounts(reviewIds),
    getAlbumCoverMapForIds(albumIds),
  ]);

  return (
    <section className="home-section mb-14">
      <div className="section-header">
        <div>
          <h2 className="section-title section-title-accent section-accent-rose">
            あなたへのおすすめセッション
          </h2>
          <p className="section-desc">
            評価したアルバム・アーティストに関連するセッション
          </p>
        </div>
        <Link href="/threads" className="link-accent hover:underline">
          すべて見る →
        </Link>
      </div>
      <RecommendedThreadList
        threads={threads}
        reviewSessions={orderedSessions}
        albumCovers={albumCovers}
        reviewReactions={reviewReactions}
        reviewCommentCounts={reviewCommentCounts}
      />
    </section>
  );
}
