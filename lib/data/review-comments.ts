import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { DbReviewComment } from "@/lib/supabase/types";
import type { ReviewComment } from "@/lib/types";

function mapCommentsWithReplies(rows: DbReviewComment[]): ReviewComment[] {
  const indexById = new Map<string, number>();
  rows.forEach((row, idx) => indexById.set(row.id, idx + 1));

  const repliesByParent = new Map<string, number[]>();
  for (const row of rows) {
    if (!row.parent_comment_id) continue;
    const list = repliesByParent.get(row.parent_comment_id) ?? [];
    list.push(indexById.get(row.id) ?? 0);
    repliesByParent.set(row.parent_comment_id, list);
  }

  return rows.map((row, idx) => ({
    id: row.id,
    reviewId: row.review_id,
    authorId: row.author_id,
    anonymousName: row.anonymous_name,
    body: row.body,
    index: idx + 1,
    parentCommentId: row.parent_comment_id,
    parentIndex: row.parent_comment_id
      ? indexById.get(row.parent_comment_id) ?? null
      : null,
    replyIndices: repliesByParent.get(row.id) ?? [],
    createdAt: row.created_at,
  }));
}

export async function getReviewComments(
  reviewId: string,
): Promise<ReviewComment[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("review_comments")
      .select("*")
      .eq("review_id", reviewId)
      .order("created_at", { ascending: true });

    if (error || !data) {
      console.error("[Supabase] getReviewComments:", error?.message);
      return [];
    }

    return mapCommentsWithReplies(data as DbReviewComment[]);
  } catch (err) {
    console.error("[Supabase] getReviewComments:", err);
    return [];
  }
}

export async function getReviewCommentsForReviews(
  reviewIds: string[],
): Promise<Map<string, ReviewComment[]>> {
  const result = new Map<string, ReviewComment[]>();
  if (!isSupabaseConfigured() || reviewIds.length === 0) return result;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("review_comments")
      .select("*")
      .in("review_id", reviewIds)
      .order("created_at", { ascending: true });

    if (error || !data) {
      console.error("[Supabase] getReviewCommentsForReviews:", error?.message);
      return result;
    }

    const byReview = new Map<string, DbReviewComment[]>();
    for (const row of data as DbReviewComment[]) {
      const list = byReview.get(row.review_id) ?? [];
      list.push(row);
      byReview.set(row.review_id, list);
    }

    for (const [reviewId, rows] of byReview) {
      result.set(reviewId, mapCommentsWithReplies(rows));
    }

    return result;
  } catch (err) {
    console.error("[Supabase] getReviewCommentsForReviews:", err);
    return result;
  }
}

export async function getReviewCommentCounts(
  reviewIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (!isSupabaseConfigured() || reviewIds.length === 0) return result;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("review_comments")
      .select("review_id")
      .in("review_id", reviewIds);

    if (error || !data) {
      console.error("[Supabase] getReviewCommentCounts:", error?.message);
      return result;
    }

    for (const row of data as { review_id: string }[]) {
      result.set(row.review_id, (result.get(row.review_id) ?? 0) + 1);
    }
    return result;
  } catch (err) {
    console.error("[Supabase] getReviewCommentCounts:", err);
    return result;
  }
}
