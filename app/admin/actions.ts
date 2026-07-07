"use server";

import { revalidatePath } from "next/cache";
import { isCurrentUserAdmin } from "@/lib/auth/admin";
import { getUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { addBannedWord, deleteBannedWord } from "@/lib/data/moderation";
import { banUser, unban, type BanSubjectType } from "@/lib/data/bans";

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

// ---------------------------------------------------------------------------
// NG ワード管理
// ---------------------------------------------------------------------------

export async function addBannedWordAction(
  pattern: string,
  isRegex: boolean,
  note: string | null,
): Promise<AdminActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  const trimmed = pattern.trim();
  if (!trimmed) return { error: "ワードを入力してください。" };
  if (trimmed.length > 200) {
    return { error: "ワードは200字以内で入力してください。" };
  }

  // 正規表現なら妥当性を検証（不正なら全投稿を止めかねないため事前に弾く）。
  if (isRegex) {
    try {
      new RegExp(trimmed, "iu");
    } catch {
      return { error: "正規表現が不正です。構文を確認してください。" };
    }
  }

  const result = await addBannedWord({
    pattern: trimmed,
    isRegex,
    note,
    createdBy: auth.selfId ?? null,
  });
  if (result.error) return { error: result.error };

  revalidatePath("/admin");
  return { success: "NG ワードを追加しました。" };
}

export async function deleteBannedWordAction(
  id: string,
): Promise<AdminActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };
  if (!id) return { error: "ID が不正です。" };

  const result = await deleteBannedWord(id);
  if (result.error) return { error: result.error };

  revalidatePath("/admin");
  return { success: "NG ワードを削除しました。" };
}

// ---------------------------------------------------------------------------
// BAN 管理
// ---------------------------------------------------------------------------

export async function banUserAction(input: {
  subjectType: BanSubjectType;
  subjectKey: string;
  reason: string | null;
  expiresAt: string | null;
}): Promise<AdminActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  if (input.subjectType !== "user" && input.subjectType !== "voter") {
    return { error: "対象種別が不正です。" };
  }

  const key = input.subjectKey.trim();
  if (!key) return { error: "対象キー（user_id または voter_key）を入力してください。" };
  if (key.length > 200) return { error: "対象キーが長すぎます。" };

  // 有効期限が指定されていれば ISO 文字列に正規化。
  let expiresAt: string | null = null;
  if (input.expiresAt) {
    const parsed = new Date(input.expiresAt);
    if (Number.isNaN(parsed.getTime())) {
      return { error: "有効期限の日時が不正です。" };
    }
    expiresAt = parsed.toISOString();
  }

  const result = await banUser({
    subjectType: input.subjectType,
    subjectKey: key,
    reason: input.reason,
    expiresAt,
    createdBy: auth.selfId ?? null,
  });
  if (result.error) return { error: result.error };

  revalidatePath("/admin");
  return { success: "BAN を追加しました。" };
}

export async function unbanAction(id: string): Promise<AdminActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };
  if (!id) return { error: "ID が不正です。" };

  const result = await unban(id);
  if (result.error) return { error: result.error };

  revalidatePath("/admin");
  return { success: "BAN を解除しました。" };
}
