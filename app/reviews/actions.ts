"use server";

import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin } from "@/lib/auth/admin";
import { getUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  normalizeAnonymousName,
  normalizePostBody,
  validatePostBody,
} from "@/lib/threads/validate";

export type ReviewCommentActionState = {
  error?: string;
  success?: string;
};

export async function createReviewComment(
  _prev: ReviewCommentActionState,
  formData: FormData,
): Promise<ReviewCommentActionState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase が未設定です。" };
  }

  const reviewId = String(formData.get("reviewId") ?? "").trim();
  const albumId = String(formData.get("albumId") ?? "").trim();
  if (!reviewId) {
    return { error: "レビューが指定されていません。" };
  }

  const nameRaw = String(formData.get("anonymousName") ?? "");
  const bodyRaw = String(formData.get("body") ?? "");
  const parentRaw = String(formData.get("parentCommentId") ?? "").trim();

  const bodyError = validatePostBody(bodyRaw);
  if (bodyError) return { error: bodyError };

  const supabase = await createClient();
  const user = await getUser();

  let parentCommentId: string | null = null;
  if (parentRaw) {
    const { data: parent, error: parentError } = await supabase
      .from("review_comments")
      .select("id, review_id")
      .eq("id", parentRaw)
      .maybeSingle();

    if (parentError || !parent || parent.review_id !== reviewId) {
      return { error: "返信先のコメントが見つかりません。" };
    }
    parentCommentId = parent.id;
  }

  const { error } = await supabase.from("review_comments").insert({
    review_id: reviewId,
    author_id: user?.id ?? null,
    anonymous_name: normalizeAnonymousName(nameRaw),
    body: normalizePostBody(bodyRaw),
    parent_comment_id: parentCommentId,
  });

  if (error) {
    return { error: error.message };
  }

  if (albumId) {
    revalidatePath(`/albums/${albumId}`);
  }
  return { success: "コメントしました。" };
}

export async function deleteReviewComment(
  commentId: string,
  albumId?: string,
): Promise<{ error?: string; success?: string }> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase が未設定です。" };
  }

  const user = await getUser();
  const supabase = await createClient();

  const { data: comment, error: fetchError } = await supabase
    .from("review_comments")
    .select("id, author_id")
    .eq("id", commentId)
    .maybeSingle();

  if (fetchError || !comment) {
    return { error: "コメントが見つかりません。" };
  }

  const admin = await isCurrentUserAdmin();
  const isAuthor = comment.author_id && user && comment.author_id === user.id;
  if (!admin && !isAuthor) {
    return { error: "削除する権限がありません。" };
  }

  const { error } = await supabase
    .from("review_comments")
    .delete()
    .eq("id", commentId);

  if (error) return { error: error.message };

  if (albumId) {
    revalidatePath(`/albums/${albumId}`);
  }
  return { success: "削除しました。" };
}
