import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { BannedWord } from "@/lib/moderation";

export type BannedWordRow = BannedWord & {
  id: string;
  pattern: string;
  is_regex: boolean;
  note: string | null;
  createdAt: string;
};

/**
 * NG ワード一覧を取得する（管理者用）。
 * RLS により管理者以外は空になる。取得失敗時は空配列。
 */
export async function getBannedWords(): Promise<BannedWordRow[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("banned_words")
      .select("id, pattern, is_regex, note, created_at")
      .order("created_at", { ascending: false });

    if (error || !data) {
      console.error("[Supabase] getBannedWords:", error?.message);
      return [];
    }

    return data.map((row) => ({
      id: row.id as string,
      pattern: row.pattern as string,
      is_regex: Boolean(row.is_regex),
      note: (row.note as string | null) ?? null,
      createdAt: row.created_at as string,
    }));
  } catch (err) {
    console.error("[Supabase] getBannedWords:", err);
    return [];
  }
}

/**
 * NG ワードを 1 件追加する（管理者用）。RLS で管理者のみ insert 可。
 */
export async function addBannedWord(input: {
  pattern: string;
  isRegex: boolean;
  note?: string | null;
  createdBy?: string | null;
}): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase が未設定です。" };

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("banned_words").insert({
      pattern: input.pattern,
      is_regex: input.isRegex,
      note: input.note?.trim() || null,
      created_by: input.createdBy ?? null,
    });

    if (error) return { error: error.message };
    return {};
  } catch (err) {
    const message = err instanceof Error ? err.message : "追加に失敗しました。";
    return { error: message };
  }
}

/**
 * NG ワードを 1 件削除する（管理者用）。
 */
export async function deleteBannedWord(id: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase が未設定です。" };

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("banned_words").delete().eq("id", id);

    if (error) return { error: error.message };
    return {};
  } catch (err) {
    const message = err instanceof Error ? err.message : "削除に失敗しました。";
    return { error: message };
  }
}
