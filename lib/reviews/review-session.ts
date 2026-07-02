import { ALBUM_RATING_CRITERIA } from "@/lib/ratings";
import type { AlbumCriteriaRatings } from "@/lib/types";
import { isMissingColumnError } from "@/lib/reviews/schema-errors";
import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type ReviewSessionInput = {
  reviewId: string;
  userId: string;
  albumId: string;
  albumTitle: string;
  body: string;
  rating: number;
  criteria: AlbumCriteriaRatings;
  sessionOptOut: boolean;
};

export function buildReviewSessionTitle(albumTitle: string): string {
  return `${albumTitle} のレビュー`.slice(0, 120);
}

export function buildReviewSessionBody(input: {
  body: string;
  rating: number;
  criteria: AlbumCriteriaRatings;
}): string {
  const parts: string[] = [];
  const trimmedBody = input.body.trim();
  if (trimmedBody) {
    parts.push(trimmedBody);
  }

  const criteriaLine = ALBUM_RATING_CRITERIA.map(
    ({ key, label }) => `${label} ${input.criteria[key]}`,
  ).join(" · ");

  parts.push(`総合評価: ${input.rating}/10`);
  parts.push(criteriaLine);

  return parts.join("\n\n").slice(0, 4000);
}

export async function syncReviewSession(
  supabase: SupabaseClient,
  input: ReviewSessionInput,
): Promise<{ threadId: string | null; error: string | null }> {
  if (input.sessionOptOut) {
    const { error } = await supabase
      .from("discussion_threads")
      .delete()
      .eq("review_id", input.reviewId);

    if (error && isMissingColumnError(error.message, "review_id")) {
      return { threadId: null, error: null };
    }

    return { threadId: null, error: error?.message ?? null };
  }

  const title = buildReviewSessionTitle(input.albumTitle);
  const body = buildReviewSessionBody(input);
  const now = new Date().toISOString();

  const { data: existing, error: lookupError } = await supabase
    .from("discussion_threads")
    .select("id")
    .eq("review_id", input.reviewId)
    .maybeSingle();

  if (lookupError && isMissingColumnError(lookupError.message, "review_id")) {
    return { threadId: null, error: null };
  }

  if (existing) {
    const { error } = await supabase
      .from("discussion_threads")
      .update({
        title,
        body,
        album_id: input.albumId,
        status: "published",
        updated_at: now,
      })
      .eq("id", existing.id);

    if (
      error &&
      (isMissingColumnError(error.message, "review_id") ||
        isMissingColumnError(error.message, "album_id"))
    ) {
      return { threadId: null, error: null };
    }

    return { threadId: existing.id, error: error?.message ?? null };
  }

  const { data: inserted, error } = await supabase
    .from("discussion_threads")
    .insert({
      author_id: input.userId,
      title,
      body,
      status: "published",
      review_id: input.reviewId,
      album_id: input.albumId,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (error && isMissingColumnError(error.message, "review_id")) {
    return { threadId: null, error: null };
  }

  return { threadId: inserted?.id ?? null, error: error?.message ?? null };
}

export async function getThreadIdsByReviewIds(
  supabase: SupabaseClient,
  reviewIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (reviewIds.length === 0) return map;

  const { data, error } = await supabase
    .from("discussion_threads")
    .select("id, review_id")
    .in("review_id", reviewIds)
    .eq("status", "published");

  if (error) {
    if (isMissingColumnError(error.message, "review_id")) {
      return map;
    }
    return map;
  }

  if (!data) return map;

  for (const row of data as { id: string; review_id: string | null }[]) {
    if (row.review_id) {
      map.set(row.review_id, row.id);
    }
  }

  return map;
}
