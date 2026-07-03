"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type NotificationActionState = {
  error?: string;
  success?: string;
};

export async function markNotificationRead(
  notificationId: string,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase が未設定です。" };
  }

  const user = await getUser();
  if (!user) return { error: "ログインが必要です。" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) return { error: error.message };

  revalidatePath("/notifications");
  return {};
}

export async function markAllNotificationsRead(): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase が未設定です。" };
  }

  const user = await getUser();
  if (!user) return { error: "ログインが必要です。" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) return { error: error.message };

  revalidatePath("/notifications");
  return {};
}
