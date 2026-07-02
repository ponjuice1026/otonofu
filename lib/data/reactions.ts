import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getUser } from "@/lib/auth/session";
import { getVoterKey } from "@/lib/threads/voter";
import type { ReactionKind, ReactionState } from "@/lib/types";

const EMPTY_STATE: ReactionState = { good: 0, bad: 0, userReaction: null };

type TargetConfig = {
  table: "review_reactions" | "discussion_post_reactions";
  fkColumn: "review_id" | "post_id";
};

const REVIEW_CONFIG: TargetConfig = {
  table: "review_reactions",
  fkColumn: "review_id",
};

const POST_CONFIG: TargetConfig = {
  table: "discussion_post_reactions",
  fkColumn: "post_id",
};

async function loadReactionStates(
  config: TargetConfig,
  targetIds: string[],
): Promise<Map<string, ReactionState>> {
  const result = new Map<string, ReactionState>();
  if (!isSupabaseConfigured() || targetIds.length === 0) return result;

  for (const id of targetIds) {
    result.set(id, { good: 0, bad: 0, userReaction: null });
  }

  try {
    const supabase = await createClient();
    const [user, voterKey] = await Promise.all([getUser(), getVoterKey()]);

    const { data, error } = await supabase
      .from(config.table)
      .select(`${config.fkColumn}, reaction, user_id, voter_key`)
      .in(config.fkColumn, targetIds);

    if (error || !data) {
      console.error(
        `[Supabase] loadReactionStates(${config.table}):`,
        error?.message,
      );
      return result;
    }

    for (const row of data as {
      [k: string]: string | null;
      reaction: ReactionKind;
    }[]) {
      const targetId = row[config.fkColumn] as string;
      const state = result.get(targetId) ?? {
        good: 0,
        bad: 0,
        userReaction: null,
      };

      if (row.reaction === "good") state.good += 1;
      else if (row.reaction === "bad") state.bad += 1;

      const isMineByUser =
        user && row.user_id && row.user_id === user.id;
      const isMineByVoter =
        !row.user_id && voterKey && row.voter_key === voterKey;
      if (isMineByUser || isMineByVoter) {
        state.userReaction = row.reaction;
      }

      result.set(targetId, state);
    }
    return result;
  } catch (err) {
    console.error(`[Supabase] loadReactionStates(${config.table}):`, err);
    return result;
  }
}

export async function getReviewReactionStates(
  reviewIds: string[],
): Promise<Map<string, ReactionState>> {
  return loadReactionStates(REVIEW_CONFIG, reviewIds);
}

export async function getPostReactionStates(
  postIds: string[],
): Promise<Map<string, ReactionState>> {
  return loadReactionStates(POST_CONFIG, postIds);
}

export function emptyReactionState(): ReactionState {
  return { ...EMPTY_STATE };
}
