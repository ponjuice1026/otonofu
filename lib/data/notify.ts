import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { NotificationType } from "@/lib/types";

type CreateNotificationInput = {
  /** 通知の宛先ユーザー。null/undefined（匿名投稿者など）なら何もしない。 */
  targetUserId: string | null | undefined;
  type: NotificationType;
  actorName: string;
  threadId?: string | null;
  reviewId?: string | null;
  postId?: string | null;
  commentId?: string | null;
  /** 通知の発生源ユーザーID（フォロー通知の遷移先解決用） */
  actorId?: string | null;
};

/**
 * 通知を作成する。RLSでは他人宛のinsertを禁止しているため、
 * security definer 関数 create_notification 経由で挿入する。
 * 宛先不明・自分自身宛は関数側でスキップされる（エラーにはしない）。
 * 通知作成の失敗は本処理（投稿等）を止めない。
 */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  if (!input.targetUserId) return;

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("create_notification", {
      target_user_id: input.targetUserId,
      notification_type: input.type,
      actor_name: input.actorName,
      target_thread_id: input.threadId ?? null,
      target_review_id: input.reviewId ?? null,
      target_post_id: input.postId ?? null,
      target_comment_id: input.commentId ?? null,
      target_actor_id: input.actorId ?? null,
    });

    if (error) {
      console.error("[Supabase] createNotification:", error.message);
    }
  } catch (err) {
    console.error("[Supabase] createNotification:", err);
  }
}
