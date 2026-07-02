import type { DiscussionThread, Review } from "@/lib/types";

export const HOME_TRENDING_REVIEW_LIMIT = 2;
export const HOME_TRENDING_REGULAR_LIMIT = 3;
export const HOME_TRENDING_POOL_SIZE =
  HOME_TRENDING_REVIEW_LIMIT + HOME_TRENDING_REGULAR_LIMIT + 12;

export function pickHomeTrendingThreadFeed(
  threads: DiscussionThread[],
  sessionReviewByThreadId: Map<string, Review>,
): {
  reviewSessions: Review[];
  regularThreads: DiscussionThread[];
} {
  const reviewSessions: Review[] = [];
  const regularThreads: DiscussionThread[] = [];

  for (const thread of threads) {
    const review = sessionReviewByThreadId.get(thread.id);

    if (review) {
      if (reviewSessions.length < HOME_TRENDING_REVIEW_LIMIT) {
        reviewSessions.push(review);
      }
    } else if (regularThreads.length < HOME_TRENDING_REGULAR_LIMIT) {
      regularThreads.push(thread);
    }

    if (
      reviewSessions.length >= HOME_TRENDING_REVIEW_LIMIT &&
      regularThreads.length >= HOME_TRENDING_REGULAR_LIMIT
    ) {
      break;
    }
  }

  return { reviewSessions, regularThreads };
}
