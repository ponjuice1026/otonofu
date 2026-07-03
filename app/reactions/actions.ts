"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getOrCreateVoterKey } from "@/lib/threads/voter";
import { createNotification } from "@/lib/data/notify";
import { ensureProfile } from "@/lib/auth/profile";
import { profilePostName } from "@/lib/threads/validate";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import type { ReactionKind } from "@/lib/types";

type ReactionResult = {
  error?: string;
  success?: string;
  /** good リアクションが新規に付与された場合 true（通知判定用） */
  goodAdded?: boolean;
};

type TargetType = "review" | "post";

type TargetConfig = {
  table: "review_reactions" | "discussion_post_reactions";
  fkColumn: "review_id" | "post_id";
};

const CONFIG: Record<TargetType, TargetConfig> = {
  review: { table: "review_reactions", fkColumn: "review_id" },
  post: { table: "discussion_post_reactions", fkColumn: "post_id" },
};

function isValidReaction(value: unknown): value is ReactionKind {
  return value === "good" || value === "bad";
}

async function toggleReaction(
  targetType: TargetType,
  targetId: string,
  reaction: ReactionKind,
): Promise<ReactionResult> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase が未設定です。" };
  }
  if (!targetId) {
    return { error: "対象が指定されていません。" };
  }
  if (!isValidReaction(reaction)) {
    return { error: "リアクションが不正です。" };
  }

  const allowed = await checkRateLimit("reaction");
  if (!allowed) return { error: RATE_LIMIT_MESSAGE };

  const config = CONFIG[targetType];
  const supabase = await createClient();
  const user = await getUser();
  const voterKey = user ? null : await getOrCreateVoterKey();

  const existingQuery = supabase
    .from(config.table)
    .select("id, reaction")
    .eq(config.fkColumn, targetId)
    .limit(1);

  if (user) {
    existingQuery.eq("user_id", user.id);
  } else if (voterKey) {
    existingQuery.is("user_id", null).eq("voter_key", voterKey);
  } else {
    return { error: "投票キーの取得に失敗しました。" };
  }

  const { data: existingRows, error: existingError } = await existingQuery;
  if (existingError) {
    return { error: existingError.message };
  }
  const existing = existingRows?.[0] as
    | { id: string; reaction: ReactionKind }
    | undefined;

  if (existing) {
    if (existing.reaction === reaction) {
      const { error } = await supabase.from(config.table).delete().eq("id", existing.id);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase.from(config.table).update({ reaction }).eq("id", existing.id);
      if (error) return { error: error.message };
    }
  } else {
    const insertPayload: Record<string, unknown> = {
      [config.fkColumn]: targetId,
      reaction,
    };
    if (user) {
      insertPayload.user_id = user.id;
    } else if (voterKey) {
      insertPayload.voter_key = voterKey;
    }
    const { error } = await supabase.from(config.table).insert(insertPayload);
    if (error) return { error: error.message };
    return {
      success: "リアクションを更新しました。",
      goodAdded: reaction === "good",
    };
  }

  return { success: "リアクションを更新しました。" };
}

export async function toggleReviewReaction(
  reviewId: string,
  reaction: ReactionKind,
  albumId?: string,
): Promise<ReactionResult> {
  const result = await toggleReaction("review", reviewId, reaction);

  // good リアクション新規付与時のみ、レビュー投稿者へ通知。
  // bad は通知しない。post リアクションは投稿者IDが無いため通知対象外。
  if (!result.error && result.goodAdded) {
    try {
      const supabase = await createClient();
      const { data: review } = await supabase
        .from("reviews")
        .select("user_id, album_id")
        .eq("id", reviewId)
        .maybeSingle();

      if (review?.user_id) {
        const user = await getUser();
        let actorName = "誰か";
        if (user) {
          const profile = await ensureProfile(user.id, user.email);
          if (profile) {
            actorName = profilePostName(profile.display_name, profile.username);
          }
        }
        await createNotification({
          targetUserId: review.user_id,
          type: "reaction",
          actorName,
          reviewId,
        });
      }
    } catch (notifyErr) {
      console.error("[notify] toggleReviewReaction:", notifyErr);
    }
  }

  if (!result.error && albumId) {
    revalidatePath(`/albums/${albumId}`);
  }
  return result;
}

export async function togglePostReaction(
  postId: string,
  reaction: ReactionKind,
  threadId?: string,
): Promise<ReactionResult> {
  const result = await toggleReaction("post", postId, reaction);
  if (!result.error && threadId) {
    revalidatePath(`/threads/${threadId}`);
  }
  return result;
}
