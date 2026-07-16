import { ReviewCard } from "@/components/review/ReviewCard";
import { getAlbumCoverMapForIds } from "@/lib/data/albums";
import { getFollowingRecentReviews } from "@/lib/data/follows";
import { getReviewReactionStates } from "@/lib/data/reactions";
import { getReviewCommentCounts } from "@/lib/data/review-comments";
import { buildReviewCardCoverProps } from "@/lib/reviews/review-card-cover";

type Props = {
  userId: string;
  limit?: number;
};

/**
 * ホームの「フォロー中のユーザーの新着レビュー」セクション。
 *
 * getFollowingRecentReviews は followee 取得 → レビュー → セッション解決の
 * ウォーターフォールを含むため、独立した async サーバコンポーネントに切り出し
 * <Suspense> でストリームさせる（公開フィードの初期描画をブロックしない）。
 */
export async function FollowingReviewsSection({ userId, limit = 6 }: Props) {
  const followingReviews = await getFollowingRecentReviews(userId, limit);
  if (followingReviews.length === 0) return null;

  const reviewIds = followingReviews.map((review) => review.id);
  const albumIds = [
    ...new Set(followingReviews.map((review) => review.albumId)),
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
          <h2 className="section-title section-title-accent section-accent-emerald">
            フォロー中のユーザーの新着レビュー
          </h2>
          <p className="section-desc">
            あなたがフォローしているユーザーの最近のレビュー
          </p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {followingReviews.map((review) => {
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
    </section>
  );
}
