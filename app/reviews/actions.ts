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
import { getOrCreateVoterKey } from "@/lib/threads/voter";
import { createNotification } from "@/lib/data/notify";
import { RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { checkContent } from "@/lib/moderation";

export type ReviewCommentActionState = {
  error?: string;
  success?: string;
};

/**
 * create_review_comment RPC が投げる英語の例外メッセージを、
 * 既存の日本語エラー文言にマップする（A-2）。
 */
function mapReviewCommentRpcError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("rate limit exceeded")) {
    return RATE_LIMIT_MESSAGE;
  }
  // NG ワード（banned word）は BAN（'banned'）より先に判定する。
  if (normalized.includes("banned word")) {
    return "投稿できない内容が含まれています。";
  }
  if (normalized.includes("banned")) {
    return "投稿が制限されています。";
  }
  if (normalized.includes("too many urls")) {
    return "URL が多すぎます。数を減らして再度お試しください。";
  }
  if (normalized.includes("review not found")) {
    return "レビューが見つかりません。";
  }
  if (normalized.includes("parent comment not found")) {
    return "返信先のコメントが見つかりません。";
  }
  if (
    normalized.includes("invalid comment body") ||
    normalized.includes("invalid anonymous name")
  ) {
    return "コメント内容を確認してください。";
  }

  return message;
}

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

  // レート制限・重複投稿チェックは create_review_comment RPC 内部で
  // check_rate_limit() を呼んで一元的に行う（A-2）。二重計上と dedup 衝突を
  // 避けるため、ここで別途 checkRateLimit は呼ばない。
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

  // 挿入は security definer RPC 経由（DB 直叩きバイパス防止 / A-2）。
  // author_id は RPC 内部で auth.uid() が使われる。
  const voterKey = await getOrCreateVoterKey();
  const { data: insertedId, error } = await supabase.rpc(
    "create_review_comment",
    {
      target_review_id: reviewId,
      comment_body: normalizePostBody(bodyRaw),
      comment_anonymous_name: actorName,
      voter_key: voterKey,
      parent_comment_id: parentCommentId,
      dedup_body: normalizePostBody(bodyRaw),
    },
  );

  if (error) {
    return { error: mapReviewCommentRpcError(error.message) };
  }

  const inserted = insertedId ? { id: insertedId as string } : null;

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
