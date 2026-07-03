"use server";

import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin } from "@/lib/auth/admin";
import { getUser } from "@/lib/auth/session";
import { createNotification } from "@/lib/data/notify";
import { isContributionKind } from "@/lib/contributions/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import type { ContributionKind } from "@/lib/types";

export type ContributeActionState = {
  error?: string;
  success?: string;
};

export type AdminContributionActionResult = {
  error?: string;
  success?: string;
};

const MAX_FIELD = 2000;

function cleanField(raw: FormDataEntryValue | null): string {
  return String(raw ?? "").trim().slice(0, MAX_FIELD);
}

/** kind ごとに payload を組み立てる。空欄は含めない。 */
function buildPayload(
  kind: ContributionKind,
  formData: FormData,
): Record<string, string> {
  const payload: Record<string, string> = {};
  const put = (key: string, name: string) => {
    const value = cleanField(formData.get(name));
    if (value) payload[key] = value;
  };

  if (kind === "add_artist") {
    put("name", "name");
    put("reading", "reading");
    put("year", "year");
    put("note", "note");
  } else if (kind === "add_album") {
    put("name", "name");
    put("artistName", "artistName");
    put("reading", "reading");
    put("year", "year");
    put("label", "label");
    put("tracklist", "tracklist");
  } else {
    // fix_data
    put("detail", "detail");
  }
  return payload;
}

export async function submitContribution(
  _prev: ContributeActionState,
  formData: FormData,
): Promise<ContributeActionState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase が未設定です。" };
  }

  const user = await getUser();
  if (!user) {
    return { error: "申請にはログインが必要です。" };
  }

  const kindRaw = String(formData.get("kind") ?? "").trim();
  if (!isContributionKind(kindRaw)) {
    return { error: "申請の種類が不正です。" };
  }
  const kind = kindRaw as ContributionKind;

  const targetArtistId = cleanField(formData.get("targetArtistId")) || null;
  const targetAlbumId = cleanField(formData.get("targetAlbumId")) || null;

  const payload = buildPayload(kind, formData);

  // 必須項目の検証
  if (kind === "fix_data") {
    if (!targetArtistId && !targetAlbumId) {
      return { error: "修正対象が指定されていません。" };
    }
    if (!payload.detail) {
      return { error: "修正内容を入力してください。" };
    }
  } else {
    if (!payload.name) {
      return { error: "名前を入力してください。" };
    }
  }

  const allowed = await checkRateLimit("contribution");
  if (!allowed) {
    return {
      error:
        "本日の申請上限（5件）に達しました。時間をおいて再度お試しください。",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("contribution_requests").insert({
    requester_id: user.id,
    kind,
    target_artist_id: kind === "fix_data" ? targetArtistId : null,
    target_album_id: kind === "fix_data" ? targetAlbumId : null,
    payload,
  });

  if (error) {
    console.error("[Supabase] submitContribution:", error.message);
    return { error: "申請の送信に失敗しました。" };
  }

  revalidatePath("/profile");
  revalidatePath("/admin");

  return {
    success:
      "申請を受け付けました。管理者の確認後、結果を通知でお知らせします。",
  };
}

async function requireAdmin(): Promise<{
  ok: boolean;
  error?: string;
  selfId?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase が未設定です。" };
  }
  const user = await getUser();
  if (!user) return { ok: false, error: "ログインが必要です。" };
  const admin = await isCurrentUserAdmin();
  if (!admin) return { ok: false, error: "管理者権限が必要です。" };
  return { ok: true, selfId: user.id };
}

async function resolveContribution(
  contributionId: string,
  status: "approved" | "rejected",
  adminNote: string | null,
): Promise<AdminContributionActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };
  if (!contributionId) return { error: "申請 ID が不正です。" };

  const admin = createAdminClient();
  const { data: request, error: fetchError } = await admin
    .from("contribution_requests")
    .select("id, requester_id, status")
    .eq("id", contributionId)
    .maybeSingle();

  if (fetchError || !request) {
    return { error: "申請が見つかりません。" };
  }
  if (request.status !== "pending") {
    return { error: "この申請はすでに処理済みです。" };
  }

  const { error: updateError } = await admin
    .from("contribution_requests")
    .update({
      status,
      admin_note: adminNote,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", contributionId)
    .eq("status", "pending");

  if (updateError) {
    console.error("[Supabase] resolveContribution:", updateError.message);
    return { error: "申請の更新に失敗しました。" };
  }

  // 申請者へ結果を通知（actorName に結果フレーズを載せる。
  // 通知本文は「あなたのデータ申請が{actorName}」の形で組み立てられる）
  await createNotification({
    targetUserId: request.requester_id,
    type: "contribution",
    actorName: status === "approved" ? "承認されました" : "却下されました",
  });

  revalidatePath("/admin");
  revalidatePath("/profile");

  return {
    success:
      status === "approved"
        ? "申請を承認しました。"
        : "申請を却下しました。",
  };
}

export async function approveContribution(
  contributionId: string,
  adminNote: string,
): Promise<AdminContributionActionResult> {
  const note = adminNote.trim().slice(0, 500) || null;
  return resolveContribution(contributionId, "approved", note);
}

export async function rejectContribution(
  contributionId: string,
  adminNote: string,
): Promise<AdminContributionActionResult> {
  const note = adminNote.trim().slice(0, 500) || null;
  return resolveContribution(contributionId, "rejected", note);
}
