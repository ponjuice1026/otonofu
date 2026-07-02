"use server";

import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin } from "@/lib/auth/admin";
import { getUser } from "@/lib/auth/session";
import {
  type ContentReportReason,
  type ContentReportTargetType,
  isContentReportReason,
  isContentReportTargetType,
} from "@/lib/reports/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getOrCreateVoterKey } from "@/lib/threads/voter";

export type ReportActionState = {
  error?: string;
  success?: string;
};

export type AdminReportActionResult = {
  error?: string;
  success?: string;
};

function normalizeDetails(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 500);
}

async function requireAdmin(): Promise<{ ok: boolean; error?: string; selfId?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase が未設定です。" };
  }

  const user = await getUser();
  if (!user) return { ok: false, error: "ログインが必要です。" };

  const admin = await isCurrentUserAdmin();
  if (!admin) return { ok: false, error: "管理者権限が必要です。" };

  return { ok: true, selfId: user.id };
}

export async function submitContentReport(
  _prev: ReportActionState,
  formData: FormData,
): Promise<ReportActionState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase が未設定です。" };
  }

  const targetTypeRaw = String(formData.get("targetType") ?? "").trim();
  const targetId = String(formData.get("targetId") ?? "").trim();
  const reasonRaw = String(formData.get("reason") ?? "").trim();
  const detailsRaw = String(formData.get("details") ?? "");

  if (!isContentReportTargetType(targetTypeRaw)) {
    return { error: "通報対象が不正です。" };
  }
  if (!targetId) {
    return { error: "通報対象が指定されていません。" };
  }
  if (!isContentReportReason(reasonRaw)) {
    return { error: "理由を選択してください。" };
  }

  const targetType = targetTypeRaw as ContentReportTargetType;
  const reason = reasonRaw as ContentReportReason;
  const details = normalizeDetails(detailsRaw);

  const supabase = await createClient();
  const user = await getUser();

  const exists = await targetContentExists(supabase, targetType, targetId);
  if (!exists) {
    return { error: "通報対象が見つかりません。" };
  }

  const insertPayload: {
    target_type: ContentReportTargetType;
    target_id: string;
    reporter_user_id: string | null;
    reporter_voter_key: string | null;
    reason: ContentReportReason;
    details: string | null;
  } = user
    ? {
        target_type: targetType,
        target_id: targetId,
        reporter_user_id: user.id,
        reporter_voter_key: null,
        reason,
        details,
      }
    : {
        target_type: targetType,
        target_id: targetId,
        reporter_user_id: null,
        reporter_voter_key: await getOrCreateVoterKey(),
        reason,
        details,
      };

  const { error } = await supabase.from("content_reports").insert(insertPayload);

  if (error) {
    if (error.code === "23505") {
      return { error: "この内容はすでに通報済みです。" };
    }
    return { error: error.message };
  }

  return { success: "通報を受け付けました。ご協力ありがとうございます。" };
}

async function targetContentExists(
  supabase: Awaited<ReturnType<typeof createClient>>,
  targetType: ContentReportTargetType,
  targetId: string,
): Promise<boolean> {
  if (targetType === "discussion_post") {
    const { data } = await supabase
      .from("discussion_posts")
      .select("id")
      .eq("id", targetId)
      .maybeSingle();
    return Boolean(data);
  }

  if (targetType === "review") {
    const { data } = await supabase
      .from("reviews")
      .select("id")
      .eq("id", targetId)
      .maybeSingle();
    return Boolean(data);
  }

  const { data } = await supabase
    .from("review_comments")
    .select("id")
    .eq("id", targetId)
    .maybeSingle();
  return Boolean(data);
}

export async function adminDeleteReportedContent(
  reportId: string,
): Promise<AdminReportActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };
  if (!reportId) return { error: "通報 ID が不正です。" };

  const admin = createAdminClient();
  const { data: report, error: fetchError } = await admin
    .from("content_reports")
    .select("id, target_type, target_id, status")
    .eq("id", reportId)
    .maybeSingle();

  if (fetchError || !report) {
    return { error: "通報が見つかりません。" };
  }
  if (report.status !== "pending") {
    return { error: "この通報はすでに処理済みです。" };
  }

  const revalidateTargets = await getReportRevalidateTargets(
    admin,
    report.target_type as ContentReportTargetType,
    report.target_id,
  );

  const deleteError = await deleteReportTarget(
    admin,
    report.target_type as ContentReportTargetType,
    report.target_id,
  );
  if (deleteError) return { error: deleteError };

  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from("content_reports")
    .update({
      status: "resolved",
      resolution: "deleted",
      resolved_by: auth.selfId,
      resolved_at: now,
    })
    .eq("target_type", report.target_type)
    .eq("target_id", report.target_id)
    .eq("status", "pending");

  if (updateError) return { error: updateError.message };

  revalidateReportPaths(revalidateTargets);
  revalidatePath("/admin");

  return { success: "コンテンツを削除し、通報を処理しました。" };
}

export async function adminDismissReport(
  reportId: string,
): Promise<AdminReportActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };
  if (!reportId) return { error: "通報 ID が不正です。" };

  const admin = createAdminClient();
  const { data: report, error: fetchError } = await admin
    .from("content_reports")
    .select("id, target_type, target_id, status")
    .eq("id", reportId)
    .maybeSingle();

  if (fetchError || !report) {
    return { error: "通報が見つかりません。" };
  }
  if (report.status !== "pending") {
    return { error: "この通報はすでに処理済みです。" };
  }

  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from("content_reports")
    .update({
      status: "dismissed",
      resolution: "dismissed",
      resolved_by: auth.selfId,
      resolved_at: now,
    })
    .eq("target_type", report.target_type)
    .eq("target_id", report.target_id)
    .eq("status", "pending");

  if (updateError) return { error: updateError.message };

  revalidatePath("/admin");
  return { success: "通報を却下しました。" };
}

async function deleteReportTarget(
  admin: ReturnType<typeof createAdminClient>,
  targetType: ContentReportTargetType,
  targetId: string,
): Promise<string | null> {
  if (targetType === "discussion_post") {
    const { error } = await admin
      .from("discussion_posts")
      .delete()
      .eq("id", targetId);
    return error?.message ?? null;
  }

  if (targetType === "review") {
    const { error } = await admin.from("reviews").delete().eq("id", targetId);
    return error?.message ?? null;
  }

  const { error } = await admin
    .from("review_comments")
    .delete()
    .eq("id", targetId);
  return error?.message ?? null;
}

type ReportRevalidateTargets = {
  paths: string[];
};

async function getReportRevalidateTargets(
  admin: ReturnType<typeof createAdminClient>,
  targetType: ContentReportTargetType,
  targetId: string,
): Promise<ReportRevalidateTargets> {
  const paths = new Set<string>();

  if (targetType === "discussion_post") {
    const { data: post } = await admin
      .from("discussion_posts")
      .select("thread_id")
      .eq("id", targetId)
      .maybeSingle();
    if (post?.thread_id) {
      paths.add(`/threads/${post.thread_id}`);
    }
    paths.add("/threads");
    return { paths: [...paths] };
  }

  if (targetType === "review") {
    const { data: review } = await admin
      .from("reviews")
      .select("album_id")
      .eq("id", targetId)
      .maybeSingle();
    if (review?.album_id) {
      paths.add(`/albums/${review.album_id}`);
    }
    paths.add("/");
    paths.add("/profile");
    return { paths: [...paths] };
  }

  const { data: comment } = await admin
    .from("review_comments")
    .select("reviews ( album_id )")
    .eq("id", targetId)
    .maybeSingle();

  type CommentRow = {
    reviews: { album_id: string } | { album_id: string }[] | null;
  };

  const row = comment as CommentRow | null;
  const reviewRel = row?.reviews;
  const albumId = Array.isArray(reviewRel)
    ? reviewRel[0]?.album_id
    : reviewRel?.album_id;

  if (albumId) {
    paths.add(`/albums/${albumId}`);
  }

  return { paths: [...paths] };
}

function revalidateReportPaths(targets: ReportRevalidateTargets) {
  for (const path of targets.paths) {
    revalidatePath(path);
  }
}
