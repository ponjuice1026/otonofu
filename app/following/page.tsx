import Link from "next/link";
import { redirect } from "next/navigation";
import { ReviewCard } from "@/components/review/ReviewCard";
import { getUser } from "@/lib/auth/session";
import { getAlbumCoverMapForIds } from "@/lib/data/albums";
import { getFolloweeIds, getFollowingRecentReviews } from "@/lib/data/follows";
import { getReviewReactionStates } from "@/lib/data/reactions";
import { getReviewCommentCounts } from "@/lib/data/review-comments";
import { buildReviewCardCoverProps } from "@/lib/reviews/review-card-cover";
import { pageTitle } from "@/lib/site";

export const metadata = {
  title: pageTitle("フォロー中の新着レビュー"),
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const FOLLOWING_REVIEWS_LIMIT = 30;

export default async function FollowingFeedPage() {
  const user = await getUser();
  if (!user) redirect("/login?redirect=/following");

  const followeeIds = await getFolloweeIds(user.id);
  const reviews =
    followeeIds.length > 0
      ? await getFollowingRecentReviews(user.id, FOLLOWING_REVIEWS_LIMIT)
      : [];

  const reviewIds = reviews.map((r) => r.id);
  const albumIds = [...new Set(reviews.map((r) => r.albumId))];

  const [reactionMap, commentCounts, albumCovers] = await Promise.all([
    getReviewReactionStates(reviewIds),
    getReviewCommentCounts(reviewIds),
    getAlbumCoverMapForIds(albumIds),
  ]);

  return (
    <div className="page-shell">
      <header className="page-header">
        <h1 className="page-title">フォロー中の新着レビュー</h1>
        <p className="page-desc">
          あなたがフォローしているユーザーの最近のレビュー
        </p>
      </header>

      {followeeIds.length === 0 ? (
        <p className="empty-state">
          まだ誰もフォローしていません。気になるユーザーのプロフィールから「フォロー」してみましょう。
        </p>
      ) : reviews.length === 0 ? (
        <p className="empty-state">
          フォロー中のユーザーの新着レビューはまだありません。
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {reviews.map((review) => {
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
                reactionState={reactionMap.get(review.id)}
                commentCount={commentCounts.get(review.id) ?? 0}
                currentUserId={user.id}
              />
            );
          })}
        </div>
      )}

      <p className="mt-8 text-sm text-[var(--muted)]">
        <Link href="/profile" className="link-accent hover:underline">
          ← プロフィールに戻る
        </Link>
      </p>
    </div>
  );
}
