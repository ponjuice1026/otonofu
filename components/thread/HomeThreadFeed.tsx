import { ReviewCard } from "@/components/review/ReviewCard";
import { TrendingThreadList } from "@/components/thread/TrendingThreadList";
import { buildReviewCardCoverProps } from "@/lib/reviews/review-card-cover";
import type { ReactionState, Review } from "@/lib/types";
import type { DiscussionThread } from "@/lib/types";

type AlbumCoverInfo = {
  coverUrl?: string;
  spotifyId?: string;
  coverColor?: string;
};

type HomeThreadFeedProps = {
  threads: DiscussionThread[];
  reviewSessions: Review[];
  variant?: "trending" | "newest";
  layout?: "list" | "row";
  albumCovers: Map<string, AlbumCoverInfo>;
  reviewReactions: Map<string, ReactionState>;
  reviewCommentCounts: Map<string, number>;
};

export function HomeThreadFeed({
  threads,
  reviewSessions,
  variant = "trending",
  layout = "row",
  albumCovers,
  reviewReactions,
  reviewCommentCounts,
}: HomeThreadFeedProps) {
  const reviewThreadIds = new Set(
    reviewSessions
      .map((review) => review.threadId)
      .filter((id): id is string => Boolean(id)),
  );
  const regularThreads = threads.filter((thread) => !reviewThreadIds.has(thread.id));

  if (reviewSessions.length === 0 && regularThreads.length === 0) {
    return (
      <TrendingThreadList threads={[]} variant={variant} layout={layout} />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {reviewSessions.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {reviewSessions.map((review) => {
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
      )}

      {regularThreads.length > 0 && (
        <TrendingThreadList
          threads={regularThreads}
          variant={variant}
          layout={layout}
        />
      )}
    </div>
  );
}
