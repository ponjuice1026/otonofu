import Link from "next/link";
import { ArtistLink } from "@/components/artist/ArtistLink";
import { ReactionButtons } from "@/components/reactions/ReactionButtons";
import { ReportButton } from "@/components/report/ReportButton";
import { CriteriaRatingsSummary } from "@/components/review/CriteriaRatingsSummary";
import { ReviewCommentsSection } from "@/components/review/ReviewCommentsSection";
import { AlbumCover } from "@/components/spotify/AlbumCover";
import { ExpandableText } from "@/components/ui/ExpandableText";
import { criteriaFromReview } from "@/lib/ratings";
import type { ReactionState, Review, ReviewComment } from "@/lib/types";

type ReviewCardProps = {
  review: Review;
  showAlbumTitle?: boolean;
  showAlbumCover?: boolean;
  albumCoverUrl?: string;
  albumCoverColor?: string;
  reactionState?: ReactionState;
  comments?: ReviewComment[];
  commentCount?: number;
  currentUserId?: string | null;
  isAdmin?: boolean;
  hideSessionLink?: boolean;
};

export function ReviewCard({
  review,
  showAlbumTitle = true,
  showAlbumCover = false,
  albumCoverUrl,
  albumCoverColor = "#262626",
  reactionState,
  comments,
  commentCount,
  currentUserId = null,
  isAdmin = false,
  hideSessionLink = false,
}: ReviewCardProps) {
  const criteria = criteriaFromReview(review);
  const hasCommentsSection = comments !== undefined;

  return (
    <article className="surface-panel p-5">
      <div className="mb-3 flex gap-3">
        {showAlbumCover && (
          <Link
            href={`/albums/${review.albumId}`}
            className="mt-0.5 shrink-0"
            aria-label={`${review.albumTitle} のアルバムページ`}
          >
            <AlbumCover
              imageUrl={albumCoverUrl}
              fallbackColor={albumCoverColor}
              title={review.albumTitle}
              size="xs"
            />
          </Link>
        )}

        <div className="min-w-0 flex-1">
          {showAlbumTitle ? (
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <Link
                  href={`/albums/${review.albumId}`}
                  className="font-semibold text-neutral-100 transition hover:text-white"
                >
                  {review.albumTitle}
                </Link>
                <span className="text-neutral-500">
                  —{" "}
                  <ArtistLink
                    artistId={review.artistId}
                    className="text-neutral-500"
                  />
                </span>
              </div>
              <CriteriaRatingsSummary
                criteria={criteria}
                average={review.rating}
                compact
                placement="header"
              />
            </div>
          ) : (
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 text-xs text-neutral-500">
                <span className="font-medium text-neutral-300">
                  {review.username}
                </span>
                <time dateTime={review.createdAt}>{review.createdAt}</time>
              </div>
              <CriteriaRatingsSummary
                criteria={criteria}
                average={review.rating}
                compact
                placement="header"
              />
            </div>
          )}
          {showAlbumTitle && (
            <div className="flex items-center gap-3 text-xs text-neutral-500">
              <span className="font-medium text-neutral-300">
                {review.username}
              </span>
              <time dateTime={review.createdAt}>{review.createdAt}</time>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3">
        <ExpandableText text={review.body} emptyFallback="（コメントなし）" />
      </div>

      {(reactionState ||
        commentCount !== undefined ||
        (review.threadId && !hideSessionLink)) && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          {reactionState ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <ReactionButtons
                target={{
                  type: "review",
                  reviewId: review.id,
                  albumId: review.albumId,
                }}
                state={reactionState}
              />
              <ReportButton
                targetType="review"
                targetId={review.id}
                triggerLabel="不適切な内容を報告"
                reportedLabel="報告済み"
                formTitle="報告理由"
                submitLabel="報告する"
              />
            </div>
          ) : (
            <span />
          )}
          {!hasCommentsSection && commentCount !== undefined && (
            <Link
              href={`/albums/${review.albumId}#review-${review.id}`}
              className="text-xs text-neutral-400 transition hover:text-neutral-200"
            >
              💬 コメント {commentCount}
            </Link>
          )}
          {review.threadId && !hideSessionLink && (
            <Link
              href={`/threads/${review.threadId}`}
              className="text-xs text-violet-300 transition hover:text-violet-200"
            >
              セッション
            </Link>
          )}
        </div>
      )}

      {hasCommentsSection && (
        <ReviewCommentsSection
          reviewId={review.id}
          albumId={review.albumId}
          comments={comments}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
        />
      )}

      {hasCommentsSection && review.threadId && !hideSessionLink && (
        <p className="mt-3">
          <Link
            href={`/threads/${review.threadId}`}
            className="text-xs text-violet-300 transition hover:text-violet-200"
          >
            このレビューのセッションへ
          </Link>
        </p>
      )}
    </article>
  );
}
