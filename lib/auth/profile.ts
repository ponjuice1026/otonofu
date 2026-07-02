import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { DbProfile } from "@/lib/supabase/types";

export async function getProfile(userId: string): Promise<DbProfile | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as DbProfile;
}

export async function ensureProfile(userId: string, email?: string | null): Promise<DbProfile | null> {
  const existing = await getProfile(userId);
  if (existing) return existing;

  if (!isSupabaseConfigured()) return null;

  const baseName = email?.split("@")[0]?.trim() || "user";
  const username = `${baseName}_${userId.slice(0, 8)}`;
  const payload = {
    id: userId,
    username,
    display_name: baseName,
  };

  const supabase = await createClient();
  const { data: inserted, error: insertError } = await supabase
    .from("profiles")
    .insert(payload)
    .select("*")
    .single();

  if (!insertError && inserted) {
    return inserted as DbProfile;
  }

  try {
    const admin = createAdminClient();
    const { data: upserted, error: upsertError } = await admin
      .from("profiles")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .single();

    if (!upsertError && upserted) {
      return upserted as DbProfile;
    }
  } catch {
    // service role 未設定時は getProfile のみ再試行
  }

  return getProfile(userId);
}
