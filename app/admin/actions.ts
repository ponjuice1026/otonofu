"use server";

import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin } from "@/lib/auth/admin";
import { getUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type AdminActionResult = {
  error?: string;
  success?: string;
};

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

export async function setUserAdminFlag(
  userId: string,
  makeAdmin: boolean,
): Promise<AdminActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  if (!userId) return { error: "ユーザー ID が不正です。" };

  if (!makeAdmin && userId === auth.selfId) {
    return { error: "自分自身の管理者権限は外せません。" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ is_admin: makeAdmin })
    .eq("id", userId);

  if (error) return { error: error.message };

  revalidatePath("/admin");
  return {
    success: makeAdmin ? "管理者に設定しました。" : "管理者を解除しました。",
  };
}

export async function setThreadFeatured(
  threadId: string,
  rank: number | null,
  note: string | null,
): Promise<AdminActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };
  if (!threadId) return { error: "セッション ID が不正です。" };

  const trimmedNote = note?.trim() || null;
  if (trimmedNote && trimmedNote.length > 80) {
    return { error: "メモは80字以内で入力してください。" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("discussion_threads")
    .update(
      rank === null
        ? { featured_rank: null, featured_note: null, featured_at: null }
        : {
            featured_rank: rank,
            featured_note: trimmedNote,
            featured_at: new Date().toISOString(),
          },
    )
    .eq("id", threadId);

  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/threads");
  return {
    success:
      rank === null ? "ピックアップを解除しました。" : "一押しに設定しました。",
  };
}

export async function adminDeleteThread(
  threadId: string,
): Promise<AdminActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };
  if (!threadId) return { error: "セッション ID が不正です。" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("discussion_threads")
    .delete()
    .eq("id", threadId);

  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/threads");
  return { success: "セッションを削除しました。" };
}
