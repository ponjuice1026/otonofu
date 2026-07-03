"use server";

import { revalidatePath } from "next/cache";
import { ensureProfile } from "@/lib/auth/profile";
import { getUser } from "@/lib/auth/session";
import { createNotification } from "@/lib/data/notify";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { profilePostName } from "@/lib/threads/validate";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";

export type FollowActionState = {
  error?: string;
  success?: string;
};

/**
 * targetId をフォローする。
 * - 要ログイン
 * - 自分自身はフォロー不可（DB制約 follower_id <> followee_id と二重に防ぐ）
 * - 既にフォロー済みなら onConflict で無視（べき等）
 * - 新規フォロー成立時のみ、対象ユーザーへ 'follow' 通知
 */
export async function followUser(targetId: string): Promise<FollowActionState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase が未設定です。" };
  }
  if (!targetId) {
    return { error: "対象が指定されていません。" };
  }

  const user = await getUser();
  if (!user) {
    return { error: "ログインが必要です。" };
  }
  if (user.id === targetId) {
    return { error: "自分自身はフォローできません。" };
  }

  const allowed = await checkRateLimit("follow");
  if (!allowed) return { error: RATE_LIMIT_MESSAGE };

  try {
    const supabase = await createClient();

    // 既存フォローの有無を確認（通知の重複送信を避けるため）
    const { data: existing } = await supabase
      .from("user_follows")
      .select("follower_id")
      .eq("follower_id", user.id)
      .eq("followee_id", targetId)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabase.from("user_follows").insert({
        follower_id: user.id,
        followee_id: targetId,
      });

      if (error) {
        return { error: error.message };
      }

      // フォロー通知（失敗しても本処理は成功扱い）
      try {
        const profile = await ensureProfile(user.id, user.email);
        const actorName = profile
          ? profilePostName(profile.display_name, profile.username)
          : "誰か";
        await createNotification({
          targetUserId: targetId,
          type: "follow",
          actorName,
          actorId: user.id,
        });
      } catch (notifyErr) {
        console.error("[notify] followUser:", notifyErr);
      }
    }

    revalidatePath(`/users/${targetId}`);
    revalidatePath("/");
    return { success: "フォローしました。" };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "フォローに失敗しました。" };
  }
}

/** targetId のフォローを解除する。要ログイン。べき等。 */
export async function unfollowUser(targetId: string): Promise<FollowActionState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase が未設定です。" };
  }
  if (!targetId) {
    return { error: "対象が指定されていません。" };
  }

  const user = await getUser();
  if (!user) {
    return { error: "ログインが必要です。" };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("user_follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("followee_id", targetId);

    if (error) {
      return { error: error.message };
    }

    revalidatePath(`/users/${targetId}`);
    revalidatePath("/");
    return { success: "フォローを解除しました。" };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "解除に失敗しました。" };
  }
}
