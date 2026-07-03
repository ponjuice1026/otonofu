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
import { createNotification } from "@/lib/data/notify";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { checkContent } from "@/lib/moderation";

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

  const moderationError = checkContent(bodyRaw);
  if (moderationError) return { error: moderationError };

  const allowed = await checkRateLimit("review_comment", {
    dedupBody: normalizePostBody(bodyRaw),
  });
  if (!allowed) return { error: RATE_LIMIT_MESSAGE };

  const supabase = await createClient();
  const user = await getUser();

  let parentCommentId: string | null = null;
  let parentAuthorId: string | null = null;
  if (parentRaw) {
    const { data: parent, error: parentError } = await supabase
      .from("review_comments")
      .select("id, review_id, author_id")
      .eq("id", parentRaw)
      .maybeSingle();

    if (parentError || !parent || parent.review_id !== reviewId) {
      return { error: "返信先のコメントが見つかりません。" };
    }
    parentCommentId = parent.id;
    parentAuthorId = parent.author_id ?? null;
  }

  const actorName = normalizeAnonymousName(nameRaw);
  const { data: inserted, error } = await supabase
    .from("review_comments")
    .insert({
      review_id: reviewId,
      author_id: user?.id ?? null,
      anonymous_name: actorName,
      body: normalizePostBody(bodyRaw),
      parent_comment_id: parentCommentId,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  // 通知: レビュー投稿者へ。返信の場合は親コメント投稿者へも。
  // 宛先未解決（匿名 author_id null）・自分自身宛は関数側でスキップ。
  try {
    const { data: review } = await supabase
      .from("reviews")
      .select("user_id")
      .eq("id", reviewId)
      .maybeSingle();

    await createNotification({
      targetUserId: review?.user_id ?? null,
      type: "review_comment",
      actorName,
      reviewId,
      commentId: inserted?.id ?? null,
    });

    if (parentAuthorId && parentAuthorId !== review?.user_id) {
      await createNotification({
        targetUserId: parentAuthorId,
        type: "comment_reply",
        actorName,
        reviewId,
        commentId: inserted?.id ?? null,
      });
    }
  } catch (notifyErr) {
    console.error("[notify] createReviewComment:", notifyErr);
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
