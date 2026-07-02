import { mapReview } from "@/lib/data/mappers";
import { getThreadIdsByReviewIds } from "@/lib/reviews/review-session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Review } from "@/lib/types";
import type { DbReview } from "@/lib/supabase/types";

type SessionThreadRef = {
  id: string;
  reviewId?: string;
  albumId?: string;
  authorId: string;
};

async function attachThreadIds(reviews: Review[]): Promise<Review[]> {
  if (reviews.length === 0) return reviews;

  const supabase = await createClient();
  const threadIds = await getThreadIdsByReviewIds(
    supabase,
    reviews.filter((review) => !review.sessionOptOut).map((review) => review.id),
  );

  return reviews.map((review) => ({
    ...review,
    threadId: threadIds.get(review.id),
  }));
}

function mapReviews(rows: DbReview[]): Review[] {
  return rows.map(mapReview);
}

export async function getReviewsByIds(ids: string[]): Promise<Review[]> {
  if (!isSupabaseConfigured() || ids.length === 0) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .in("id", ids)
      .not("user_id", "is", null);

    if (error || !data) {
      console.error("[Supabase] getReviewsByIds:", error?.message);
      return [];
    }

    return attachThreadIds(mapReviews(data as DbReview[]));
  } catch (err) {
    console.error("[Supabase] getReviewsByIds:", err);
    return [];
  }
}

/** セッション一覧用: 最大2クエリでレビューをまとめて解決（N+1 回避） */
export async function getReviewSessionsForThreads(
  threads: SessionThreadRef[],
  options?: { cachedReviews?: Review[] },
): Promise<Review[]> {
  if (!isSupabaseConfigured() || threads.length === 0) return [];

  try {
    const supabase = await createClient();
    const cachedById = new Map(
      (options?.cachedReviews ?? []).map((review) => [review.id, review]),
    );
    const reviewById = new Map<string, Review>(cachedById);
    const reviewIdsToFetch = new Set<string>();
    const authorIds = new Set<string>();
    const albumIds = new Set<string>();

    for (const thread of threads) {
      if (thread.reviewId && !reviewById.has(thread.reviewId)) {
        reviewIdsToFetch.add(thread.reviewId);
      } else if (thread.albumId) {
        authorIds.add(thread.authorId);
        albumIds.add(thread.albumId);
      }
    }

    if (reviewIdsToFetch.size > 0) {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .in("id", [...reviewIdsToFetch])
        .not("user_id", "is", null);

      if (error) {
        console.error("[Supabase] getReviewSessionsForThreads by id:", error.message);
      } else {
        for (const row of mapReviews((data ?? []) as DbReview[])) {
          reviewById.set(row.id, row);
        }
      }
    }

    if (authorIds.size > 0 && albumIds.size > 0) {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .in("user_id", [...authorIds])
        .in("album_id", [...albumIds])
        .not("user_id", "is", null);

      if (error) {
        console.error(
          "[Supabase] getReviewSessionsForThreads by author/album:",
          error.message,
        );
      } else {
        for (const row of mapReviews((data ?? []) as DbReview[])) {
          if (!reviewById.has(row.id)) {
            reviewById.set(row.id, row);
          }
        }
      }
    }

    const results: Review[] = [];
    const seenReviewIds = new Set<string>();

    for (const thread of threads) {
      let review: Review | undefined;

      if (thread.reviewId) {
        review = reviewById.get(thread.reviewId);
      } else if (thread.albumId) {
        review = [...reviewById.values()].find(
          (candidate) =>
            candidate.userId === thread.authorId &&
            candidate.albumId === thread.albumId,
        );
      }

      if (!review || seenReviewIds.has(review.id)) continue;

      seenReviewIds.add(review.id);
      results.push({
        ...review,
        threadId: thread.id,
      });
    }

    return results;
  } catch (err) {
    console.error("[Supabase] getReviewSessionsForThreads:", err);
    return [];
  }
}

export async function getReviewById(id: string): Promise<Review | null> {
  const [review] = await getReviewsByIds([id]);
  return review ?? null;
}

export async function getReviewForSessionThread(
  thread: SessionThreadRef,
): Promise<Review | null> {
  const [review] = await getReviewSessionsForThreads([thread]);
  return review ?? null;
}

export async function getRecentReviews(limit = 5): Promise<Review[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .not("user_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) {
      console.error("[Supabase] getRecentReviews:", error?.message);
      return [];
    }

    return attachThreadIds(mapReviews(data as DbReview[]));
  } catch (err) {
    console.error("[Supabase] getRecentReviews:", err);
    return [];
  }
}

export async function getReviews(): Promise<Review[]> {
  return getRecentReviews(20);
}

export async function getTrendingReviews(limit = 6): Promise<Review[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createClient();
    const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

    const { data: reviewRows, error } = await supabase
      .from("reviews")
      .select("*")
      .not("user_id", "is", null)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(Math.max(limit * 5, 30));

    if (error || !reviewRows) {
      console.error("[Supabase] getTrendingReviews:", error?.message);
      return [];
    }

    const reviews = await attachThreadIds(mapReviews(reviewRows as DbReview[]));
    if (reviews.length === 0) return [];

    const reviewIds = reviews.map((r) => r.id);
    const { data: reactions } = await supabase
      .from("review_reactions")
      .select("review_id, reaction")
      .in("review_id", reviewIds);

    const goodMap = new Map<string, number>();
    const badMap = new Map<string, number>();
    for (const row of (reactions ?? []) as {
      review_id: string;
      reaction: string;
    }[]) {
      if (row.reaction === "good") {
        goodMap.set(row.review_id, (goodMap.get(row.review_id) ?? 0) + 1);
      } else if (row.reaction === "bad") {
        badMap.set(row.review_id, (badMap.get(row.review_id) ?? 0) + 1);
      }
    }

    const now = Date.now();
    const scored = reviews
      .map((review) => {
        const goods = goodMap.get(review.id) ?? 0;
        const bads = badMap.get(review.id) ?? 0;
        const ageDays =
          (now - new Date(review.createdAt).getTime()) / (24 * 60 * 60 * 1000);
        const recencyBoost = 1 / Math.log2(Math.max(ageDays, 1) + 2);
        const score = (goods * 5 - bads + 1) * recencyBoost;
        return { review, score, goods };
      })
      .sort((a, b) => {
        if (b.goods !== a.goods) return b.goods - a.goods;
        return b.score - a.score;
      })
      .slice(0, limit);

    return scored.map((item) => item.review);
  } catch (err) {
    console.error("[Supabase] getTrendingReviews:", err);
    return [];
  }
}

export async function getReviewsByAlbumId(albumId: string): Promise<Review[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("album_id", albumId)
      .not("user_id", "is", null)
      .order("created_at", { ascending: false });

    if (error || !data) {
      console.error("[Supabase] getReviewsByAlbumId:", error?.message);
      return [];
    }

    return attachThreadIds(mapReviews(data as DbReview[]));
  } catch (err) {
    console.error("[Supabase] getReviewsByAlbumId:", err);
    return [];
  }
}

export async function getReviewsByUserId(userId: string): Promise<Review[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error || !data) {
      console.error("[Supabase] getReviewsByUserId:", error?.message);
      return [];
    }

    return attachThreadIds(mapReviews(data as DbReview[]));
  } catch (err) {
    console.error("[Supabase] getReviewsByUserId:", err);
    return [];
  }
}

export async function getUserReviewForAlbum(
  userId: string,
  albumId: string,
): Promise<Review | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("user_id", userId)
      .eq("album_id", albumId)
      .maybeSingle();

    if (error || !data) return null;
    const [review] = await attachThreadIds([mapReview(data as DbReview)]);
    return review ?? null;
  } catch {
    return null;
  }
}
