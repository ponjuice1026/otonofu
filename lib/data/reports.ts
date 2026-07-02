import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  CONTENT_REPORT_REASON_LABELS,
  CONTENT_REPORT_TARGET_LABELS,
  type ContentReportReason,
  type ContentReportTargetType,
} from "@/lib/reports/constants";
import type { DbContentReport } from "@/lib/supabase/types";

export type AdminReportRow = {
  id: string;
  targetType: ContentReportTargetType;
  targetId: string;
  targetLabel: string;
  reason: ContentReportReason;
  reasonLabel: string;
  details: string | null;
  createdAt: string;
  reportCount: number;
  contentPreview: string;
  contextLabel: string;
  contextHref: string;
};

function truncate(text: string, max = 160): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

export async function getPendingReportCount(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("content_reports")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    if (error) {
      console.error("[Supabase] getPendingReportCount:", error.message);
      return 0;
    }

    return count ?? 0;
  } catch (err) {
    console.error("[Supabase] getPendingReportCount:", err);
    return 0;
  }
}

export async function getAdminReports(limit = 50): Promise<AdminReportRow[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("content_reports")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) {
      console.error("[Supabase] getAdminReports:", error?.message);
      return [];
    }

    const reports = data as DbContentReport[];
    if (reports.length === 0) return [];

    const countMap = new Map<string, number>();
    for (const report of reports) {
      const key = `${report.target_type}:${report.target_id}`;
      countMap.set(key, (countMap.get(key) ?? 0) + 1);
    }

    const postIds = reports
      .filter((r) => r.target_type === "discussion_post")
      .map((r) => r.target_id);
    const reviewIds = reports
      .filter((r) => r.target_type === "review")
      .map((r) => r.target_id);
    const commentIds = reports
      .filter((r) => r.target_type === "review_comment")
      .map((r) => r.target_id);

    const postMap = new Map<
      string,
      { body: string; threadId: string; threadTitle: string }
    >();
    const reviewMap = new Map<
      string,
      { body: string; albumId: string; albumTitle: string; username: string }
    >();
    const commentMap = new Map<
      string,
      {
        body: string;
        reviewId: string;
        albumId: string;
        albumTitle: string;
      }
    >();

    if (postIds.length > 0) {
      const { data: posts } = await supabase
        .from("discussion_posts")
        .select("id, body, thread_id, discussion_threads ( title )")
        .in("id", [...new Set(postIds)]);

      for (const post of posts ?? []) {
        type PostRow = {
          id: string;
          body: string;
          thread_id: string;
          discussion_threads:
            | { title: string }
            | { title: string }[]
            | null;
        };
        const row = post as PostRow;
        const thread = Array.isArray(row.discussion_threads)
          ? row.discussion_threads[0]
          : row.discussion_threads;

        postMap.set(row.id, {
          body: row.body,
          threadId: row.thread_id,
          threadTitle: thread?.title ?? "セッション",
        });
      }
    }

    if (reviewIds.length > 0) {
      const { data: reviews } = await supabase
        .from("reviews")
        .select("id, body, album_id, album_title, username")
        .in("id", [...new Set(reviewIds)]);

      for (const review of reviews ?? []) {
        reviewMap.set(review.id, {
          body: review.body,
          albumId: review.album_id,
          albumTitle: review.album_title,
          username: review.username,
        });
      }
    }

    if (commentIds.length > 0) {
      const { data: comments } = await supabase
        .from("review_comments")
        .select(
          "id, body, review_id, reviews ( album_id, album_title )",
        )
        .in("id", [...new Set(commentIds)]);

      for (const comment of comments ?? []) {
        type CommentRow = {
          id: string;
          body: string;
          review_id: string;
          reviews:
            | { album_id: string; album_title: string }
            | { album_id: string; album_title: string }[]
            | null;
        };
        const row = comment as CommentRow;
        const review = Array.isArray(row.reviews) ? row.reviews[0] : row.reviews;

        commentMap.set(row.id, {
          body: row.body,
          reviewId: row.review_id,
          albumId: review?.album_id ?? "",
          albumTitle: review?.album_title ?? "アルバム",
        });
      }
    }

    return reports.map((report) => {
      const key = `${report.target_type}:${report.target_id}`;
      const targetType = report.target_type as ContentReportTargetType;
      const reason = report.reason as ContentReportReason;

      let contentPreview = "（コンテンツが見つかりません）";
      let contextLabel = "—";
      let contextHref = "/";

      if (targetType === "discussion_post") {
        const post = postMap.get(report.target_id);
        if (post) {
          contentPreview = truncate(post.body);
          contextLabel = post.threadTitle;
          contextHref = `/threads/${post.threadId}`;
        }
      } else if (targetType === "review") {
        const review = reviewMap.get(report.target_id);
        if (review) {
          contentPreview = truncate(review.body || "（本文なし）");
          contextLabel = `${review.albumTitle} — ${review.username}`;
          contextHref = `/albums/${review.albumId}#review-${report.target_id}`;
        }
      } else {
        const comment = commentMap.get(report.target_id);
        if (comment) {
          contentPreview = truncate(comment.body);
          contextLabel = comment.albumTitle;
          contextHref = `/albums/${comment.albumId}#review-${comment.reviewId}`;
        }
      }

      return {
        id: report.id,
        targetType,
        targetId: report.target_id,
        targetLabel: CONTENT_REPORT_TARGET_LABELS[targetType],
        reason,
        reasonLabel: CONTENT_REPORT_REASON_LABELS[reason],
        details: report.details,
        createdAt: report.created_at,
        reportCount: countMap.get(key) ?? 1,
        contentPreview,
        contextLabel,
        contextHref,
      };
    });
  } catch (err) {
    console.error("[Supabase] getAdminReports:", err);
    return [];
  }
}
