import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getDiscussionPoll } from "@/lib/data/polls";
import { getVoterKey, getOrCreateVoterKey } from "@/lib/threads/voter";
import { POLL_OPTION_MAX_COUNT } from "@/lib/threads/validate";

export async function registerThreadParticipant(threadId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    const participantKey = await getOrCreateVoterKey();
    const supabase = await createClient();
    const { error } = await supabase.rpc("register_thread_participant", {
      target_thread_id: threadId,
      participant_key: participantKey,
    });

    if (error) {
      console.error("[Supabase] register_thread_participant:", error.message);
    }
  } catch (err) {
    console.error("[Supabase] registerThreadParticipant:", err);
  }
}

export async function canAddPollOption(
  threadId: string,
  authorId: string,
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const user = await getUser();
  if (user?.id === authorId) return false;

  const participantKey = await getVoterKey();
  if (!participantKey) return false;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("discussion_thread_participants")
      .select("participant_key")
      .eq("thread_id", threadId)
      .eq("participant_key", participantKey)
      .maybeSingle();

    if (error || !data) return false;

    const poll = await getDiscussionPoll(threadId);
    if (!poll) return false;

    return poll.options.length < POLL_OPTION_MAX_COUNT;
  } catch {
    return false;
  }
}
