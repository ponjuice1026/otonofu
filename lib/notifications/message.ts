import type { NotificationType } from "@/lib/types";

/** 通知タイプ + アクター名から日本語の本文を組み立てる。 */
export function notificationMessage(
  type: NotificationType,
  actorName: string,
): string {
  const name = actorName.trim() || "誰か";
  switch (type) {
    case "thread_reply":
      return `${name}さんがあなたのセッションに投稿しました`;
    case "post_reply":
      return `${name}さんがあなたのセッションに返信しました`;
    case "review_comment":
      return `${name}さんがあなたのレビューにコメントしました`;
    case "comment_reply":
      return `${name}さんがあなたのコメントに返信しました`;
    case "reaction":
      return `${name}さんがあなたのレビューにgoodしました`;
    case "follow":
      return `${name}さんがあなたをフォローしました`;
    case "contribution":
      // actorName に「承認されました」等の結果ラベルを入れて渡す
      return `あなたのデータ申請が${actorName.trim() || "更新されました"}`;
    default:
      return `${name}さんからの通知`;
  }
}
