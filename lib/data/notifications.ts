import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { DbNotification } from "@/lib/supabase/types";
import type { Notification } from "@/lib/types";

/**
 * 通知の遷移先URLを解決する。
 * レビューはアルバムページ上にアンカー表示されるため、review_id → album_id を解決して
 * `/albums/{albumId}#review-{reviewId}` へ飛ばす（albumMap で解決できない場合は /notifications）。
 */
function resolveHref(
  row: DbNotification,
  albumByReview: Map<string, string>,
): string {
  if (row.type === "follow" && row.actor_id) {
    return `/users/${row.actor_id}`;
  }
  if (row.type === "contribution") {
    return "/profile#my-contributions";
  }
  if (row.thread_id) {
    return row.post_id
      ? `/threads/${row.thread_id}#post-${row.post_id}`
      : `/threads/${row.thread_id}`;
  }
  if (row.review_id) {
    const albumId = albumByReview.get(row.review_id);
    if (albumId) {
      return `/albums/${albumId}#review-${row.review_id}`;
    }
  }
  return "/notifications";
}

function mapNotification(
  row: DbNotification,
  albumByReview: Map<string, string>,
): Notification {
  return {
    id: row.id,
    type: row.type,
    actorName: row.actor_name,
    actorId: row.actor_id,
    threadId: row.thread_id,
    reviewId: row.review_id,
    postId: row.post_id,
    commentId: row.comment_id,
    readAt: row.read_at,
    createdAt: row.created_at,
    href: resolveHref(row, albumByReview),
  };
}

const NOTIFICATIONS_PAGE_SIZE = 50;

export async function getNotifications(
  userId: string,
  limit = NOTIFICATIONS_PAGE_SIZE,
): Promise<Notification[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) {
      console.error("[Supabase] getNotifications:", error?.message);
      return [];
    }

    const rows = data as DbNotification[];

    // レビュー通知の遷移先（アルバムページ）解決のため album_id をまとめて取得
    const reviewIds = [
      ...new Set(
        rows
          .map((row) => row.review_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const albumByReview = new Map<string, string>();
    if (reviewIds.length > 0) {
      const { data: reviews } = await supabase
        .from("reviews")
        .select("id, album_id")
        .in("id", reviewIds);
      for (const review of (reviews ?? []) as {
        id: string;
        album_id: string | null;
      }[]) {
        if (review.album_id) albumByReview.set(review.id, review.album_id);
      }
    }

    return rows.map((row) => mapNotification(row, albumByReview));
  } catch (err) {
    console.error("[Supabase] getNotifications:", err);
    return [];
  }
}

export async function getUnreadNotificationCount(
  userId: string,
): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null);

    if (error) {
      console.error("[Supabase] getUnreadNotificationCount:", error.message);
      return 0;
    }

    return count ?? 0;
  } catch (err) {
    console.error("[Supabase] getUnreadNotificationCount:", err);
    return 0;
  }
}
