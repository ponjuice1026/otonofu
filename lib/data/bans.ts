import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type BanSubjectType = "user" | "voter";

export type BanRow = {
  id: string;
  subjectType: BanSubjectType;
  subjectKey: string;
  reason: string | null;
  createdAt: string;
  expiresAt: string | null;
};

/**
 * BAN 一覧を取得する（管理者用）。RLS により管理者以外は空になる。
 */
export async function listBans(): Promise<BanRow[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("user_bans")
      .select("id, subject_type, subject_key, reason, created_at, expires_at")
      .order("created_at", { ascending: false });

    if (error || !data) {
      console.error("[Supabase] listBans:", error?.message);
      return [];
    }

    return data.map((row) => ({
      id: row.id as string,
      subjectType: row.subject_type as BanSubjectType,
      subjectKey: row.subject_key as string,
      reason: (row.reason as string | null) ?? null,
      createdAt: row.created_at as string,
      expiresAt: (row.expires_at as string | null) ?? null,
    }));
  } catch (err) {
    console.error("[Supabase] listBans:", err);
    return [];
  }
}

/**
 * BAN を 1 件追加する（管理者用）。RLS で管理者のみ insert 可。
 */
export async function banUser(input: {
  subjectType: BanSubjectType;
  subjectKey: string;
  reason?: string | null;
  expiresAt?: string | null;
  createdBy?: string | null;
}): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase が未設定です。" };

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("user_bans").insert({
      subject_type: input.subjectType,
      subject_key: input.subjectKey,
      reason: input.reason?.trim() || null,
      expires_at: input.expiresAt ?? null,
      created_by: input.createdBy ?? null,
    });

    if (error) return { error: error.message };
    return {};
  } catch (err) {
    const message = err instanceof Error ? err.message : "BAN に失敗しました。";
    return { error: message };
  }
}

/**
 * BAN を 1 件解除（削除）する（管理者用）。
 */
export async function unban(id: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase が未設定です。" };

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("user_bans").delete().eq("id", id);

    if (error) return { error: error.message };
    return {};
  } catch (err) {
    const message = err instanceof Error ? err.message : "解除に失敗しました。";
    return { error: message };
  }
}
