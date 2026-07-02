"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isCurrentUserAdmin } from "@/lib/auth/admin";
import { ensureProfile, getProfile } from "@/lib/auth/profile";
import { getUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  POLL_OPTION_MAX_COUNT,
  normalizeAnonymousName,
  normalizeDraftTitle,
  normalizePostBody,
  normalizeThreadBody,
  normalizeTitle,
  parsePollOptionsFromFormData,
  profilePostName,
  type PollOptionInput,
  validatePollOptionAdd,
  validatePollOptions,
  validatePostBody,
  validateThreadBody,
  validateTitle,
} from "@/lib/threads/validate";
import { getOrCreateVoterKey, getVoterKey } from "@/lib/threads/voter";
import { registerThreadParticipant } from "@/lib/data/poll-participants";
import { buildViewOnlyPollOptionInput } from "@/lib/threads/poll-defaults";

export type ThreadActionState = {
  error?: string;
  success?: string;
  votedOptionId?: string;
};

async function requireUser() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase が未設定です。");
  }

  const user = await getUser();
  if (!user) {
    throw new Error("ログインが必要です。");
  }

  const profile = await ensureProfile(user.id, user.email);
  if (!profile) {
    throw new Error("プロフィールの作成に失敗しました。");
  }

  return { user, profile };
}

function filterPollOptionsForDraft(options: PollOptionInput[]): PollOptionInput[] {
  return options
    .filter((option) => option.label.trim().length > 0)
    .slice(0, POLL_OPTION_MAX_COUNT);
}

async function syncThreadPollOptions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  threadId: string,
  pollOptions: PollOptionInput[],
) {
  const { error: deleteError } = await supabase
    .from("discussion_poll_options")
    .delete()
    .eq("thread_id", threadId);

  if (deleteError) {
    return deleteError.message;
  }

  if (pollOptions.length === 0) {
    return null;
  }

  const { error: insertError } = await supabase
    .from("discussion_poll_options")
    .insert(
      pollOptions.map((option, position) => ({
        thread_id: threadId,
        label: option.label,
        position,
        option_type: option.type,
        album_id: option.type === "album" ? option.albumId ?? null : null,
        artist_id: option.type === "artist" ? option.artistId ?? null : null,
        exclude_from_tally: option.excludeFromTally ?? false,
      })),
    );

  return insertError?.message ?? null;
}

function parseThreadPollOptionsFromForm(formData: FormData): {
  enablePoll: boolean;
  addViewOnlyOption: boolean;
  pollOptions: PollOptionInput[];
} {
  const enablePoll = formData.get("enablePoll") === "on";
  const addViewOnlyOption =
    enablePoll && formData.get("addViewOnlyOption") === "on";
  let pollOptions = enablePoll ? parsePollOptionsFromFormData(formData) : [];

  if (enablePoll && addViewOnlyOption) {
    if (pollOptions.length >= POLL_OPTION_MAX_COUNT) {
      return {
        enablePoll,
        addViewOnlyOption,
        pollOptions,
      };
    }
    pollOptions = [...pollOptions, buildViewOnlyPollOptionInput()];
  }

  return { enablePoll, addViewOnlyOption, pollOptions };
}

export async function saveDiscussionThread(
  _prev: ThreadActionState,
  formData: FormData,
): Promise<ThreadActionState> {
  try {
    const { user } = await requireUser();

    const intent = formData.get("intent") === "publish" ? "publish" : "draft";
    const threadId = String(formData.get("threadId") ?? "").trim();
    const titleRaw = String(formData.get("title") ?? "");
    const bodyRaw = String(formData.get("body") ?? "");
    const { enablePoll, addViewOnlyOption, pollOptions: rawPollOptions } =
      parseThreadPollOptionsFromForm(formData);

    if (intent === "publish") {
      const titleError = validateTitle(titleRaw);
      if (titleError) return { error: titleError };

      const bodyError = validateThreadBody(bodyRaw);
      if (bodyError) return { error: bodyError };

      if (enablePoll) {
        const pollOptions = rawPollOptions.filter(
          (option) => !option.excludeFromTally,
        );
        const pollError = validatePollOptions(pollOptions);
        if (pollError) return { error: pollError };

        if (addViewOnlyOption && rawPollOptions.length >= POLL_OPTION_MAX_COUNT) {
          return {
            error: `選択肢は${POLL_OPTION_MAX_COUNT}つまでです。結果閲覧用を付ける場合は集計対象の選択肢を減らしてください。`,
          };
        }
      }
    }

    const title =
      intent === "publish"
        ? normalizeTitle(titleRaw)
        : normalizeDraftTitle(titleRaw);
    const body = normalizeThreadBody(bodyRaw);
    const status = intent === "publish" ? "published" : "draft";

    let pollOptionsToSave: PollOptionInput[] = [];
    if (enablePoll) {
      if (intent === "publish") {
        pollOptionsToSave = rawPollOptions;
      } else {
        const tallyOptions = filterPollOptionsForDraft(
          rawPollOptions.filter((option) => !option.excludeFromTally),
        );
        pollOptionsToSave = [...tallyOptions];
        if (
          addViewOnlyOption &&
          pollOptionsToSave.length < POLL_OPTION_MAX_COUNT
        ) {
          pollOptionsToSave.push(buildViewOnlyPollOptionInput());
        }
      }
    }

    const supabase = await createClient();
    let savedThreadId = threadId;

    if (threadId) {
      const { data: existing, error: fetchError } = await supabase
        .from("discussion_threads")
        .select("id, author_id, status")
        .eq("id", threadId)
        .maybeSingle();

      if (fetchError || !existing) {
        return { error: "下書きが見つかりません。" };
      }
      if (existing.author_id !== user.id) {
        return { error: "編集する権限がありません。" };
      }
      if (existing.status !== "draft") {
        return { error: "公開済みのセッションはこのフォームから編集できません。" };
      }

      const { error: updateError } = await supabase
        .from("discussion_threads")
        .update({
          title,
          body,
          status,
        })
        .eq("id", threadId);

      if (updateError) {
        return { error: updateError.message };
      }
    } else {
      const { data, error } = await supabase
        .from("discussion_threads")
        .insert({
          author_id: user.id,
          title,
          body,
          status,
        })
        .select("id")
        .single();

      if (error || !data) {
        return { error: error?.message ?? "セッションの保存に失敗しました。" };
      }

      savedThreadId = data.id;
    }

    const pollSyncError = await syncThreadPollOptions(
      supabase,
      savedThreadId,
      pollOptionsToSave,
    );
    if (pollSyncError) {
      return { error: pollSyncError };
    }

    revalidatePath("/threads");
    revalidatePath("/threads/new");

    if (intent === "publish") {
      redirect(`/threads/${savedThreadId}`);
    }

    redirect(`/threads/new?draft=${savedThreadId}&saved=1`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "エラーが発生しました。";
    if (message === "ログインが必要です。") {
      return { error: message };
    }
    if (message === "NEXT_REDIRECT") {
      throw err;
    }
    return { error: message };
  }
}

/** @deprecated Use saveDiscussionThread */
export async function createDiscussionThread(
  prev: ThreadActionState,
  formData: FormData,
): Promise<ThreadActionState> {
  if (!formData.get("intent")) {
    formData.set("intent", "publish");
  }
  return saveDiscussionThread(prev, formData);
}

export async function createDiscussionPost(
  _prev: ThreadActionState,
  formData: FormData,
): Promise<ThreadActionState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase が未設定です。" };
  }

  const threadId = String(formData.get("threadId") ?? "").trim();
  if (!threadId) {
    return { error: "セッションが指定されていません。" };
  }

  const nameRaw = String(formData.get("anonymousName") ?? "");
  const bodyRaw = String(formData.get("body") ?? "");
  const replyToRaw = String(formData.get("parentPostId") ?? "").trim();
  const postAnonymously = formData.get("postAnonymously") === "on";

  const bodyError = validatePostBody(bodyRaw);
  if (bodyError) return { error: bodyError };

  const supabase = await createClient();
  const user = await getUser();

  let displayName: string;
  if (user && !postAnonymously) {
    const profile = await ensureProfile(user.id, user.email);
    if (!profile) {
      return { error: "プロフィールの取得に失敗しました。" };
    }
    displayName = profilePostName(profile.display_name, profile.username);
  } else {
    displayName = normalizeAnonymousName(nameRaw);
  }

  let parentPostId: string | null = null;
  if (replyToRaw) {
    const { data: parent, error: parentError } = await supabase
      .from("discussion_posts")
      .select("id, thread_id")
      .eq("id", replyToRaw)
      .maybeSingle();

    if (parentError || !parent || parent.thread_id !== threadId) {
      return { error: "返信先のコメントが見つかりません。" };
    }
    parentPostId = parent.id;
  }

  const { error } = await supabase.from("discussion_posts").insert({
    thread_id: threadId,
    anonymous_name: displayName,
    body: normalizePostBody(bodyRaw),
    parent_post_id: parentPostId,
  });

  if (error) {
    return { error: error.message };
  }

  await registerThreadParticipant(threadId);

  revalidatePath(`/threads/${threadId}`);
  revalidatePath("/threads");
  return { success: "投稿しました。" };
}

export async function voteDiscussionPoll(
  _prev: ThreadActionState,
  formData: FormData,
): Promise<ThreadActionState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase が未設定です。" };
  }

  const threadId = String(formData.get("threadId") ?? "").trim();
  const optionId = String(formData.get("optionId") ?? "").trim();

  if (!threadId || !optionId) {
    return { error: "投票内容が不正です。" };
  }

  const supabase = await createClient();
  const { data: option, error: optionError } = await supabase
    .from("discussion_poll_options")
    .select("id, thread_id")
    .eq("id", optionId)
    .eq("thread_id", threadId)
    .maybeSingle();

  if (optionError || !option) {
    return { error: "選択肢が見つかりません。" };
  }

  const voterKey = await getOrCreateVoterKey();
  const { error } = await supabase.from("discussion_poll_votes").insert({
    thread_id: threadId,
    option_id: optionId,
    voter_key: voterKey,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "このセッションにはすでに投票済みです。" };
    }
    return { error: error.message };
  }

  revalidatePath(`/threads/${threadId}`);
  revalidatePath("/threads");
  return { success: "投票しました。", votedOptionId: optionId };
}

function mapPollOptionRpcError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("not a thread participant")) {
    return "このセッションに返信すると、選択肢を追加できます。";
  }
  if (normalized.includes("thread author cannot add")) {
    return "セッション作成者は選択肢を追加できません。";
  }
  if (normalized.includes("poll option limit")) {
    return "選択肢は8つまでです。";
  }
  if (normalized.includes("duplicate poll option")) {
    return "同じ選択肢がすでにあります。";
  }
  if (normalized.includes("thread has no poll")) {
    return "このセッションには投票がありません。";
  }
  if (normalized.includes("invalid option")) {
    return "選択肢の内容を確認してください。";
  }

  return message;
}

export async function addDiscussionPollOption(
  _prev: ThreadActionState,
  formData: FormData,
): Promise<ThreadActionState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase が未設定です。" };
  }

  const threadId = String(formData.get("threadId") ?? "").trim();
  if (!threadId) {
    return { error: "セッションが指定されていません。" };
  }

  const pollOptions = parsePollOptionsFromFormData(formData);
  const pollError = validatePollOptionAdd(pollOptions);
  if (pollError) return { error: pollError };

  const participantKey = await getVoterKey();
  if (!participantKey) {
    return { error: "このセッションに返信すると、選択肢を追加できます。" };
  }

  const user = await getUser();
  const supabase = await createClient();

  const { data: thread, error: threadError } = await supabase
    .from("discussion_threads")
    .select("author_id")
    .eq("id", threadId)
    .maybeSingle();

  if (threadError || !thread) {
    return { error: "セッションが見つかりません。" };
  }

  if (user?.id === thread.author_id) {
    return { error: "セッション作成者は選択肢を追加できません。" };
  }

  const option = { ...pollOptions[0], excludeFromTally: false };
  const { error } = await supabase.rpc("add_discussion_poll_option_by_participant", {
    target_thread_id: threadId,
    participant_key: participantKey,
    option_type: option.type,
    option_label: option.label,
    option_album_id: option.type === "album" ? option.albumId ?? null : null,
    option_artist_id: option.type === "artist" ? option.artistId ?? null : null,
    option_exclude_from_tally: false,
  });

  if (error) {
    return { error: mapPollOptionRpcError(error.message) };
  }

  revalidatePath(`/threads/${threadId}`);
  revalidatePath("/threads");
  return { success: "選択肢を追加しました。" };
}

export async function deleteDiscussionThread(
  threadId: string,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase が未設定です。" };
  }

  const user = await getUser();
  if (!user) return { error: "ログインが必要です。" };

  const profile = await getProfile(user.id);
  const supabase = await createClient();

  const { data: thread, error: fetchError } = await supabase
    .from("discussion_threads")
    .select("id, author_id")
    .eq("id", threadId)
    .maybeSingle();

  if (fetchError || !thread) {
    return { error: "セッションが見つかりません。" };
  }

  const canDelete = profile?.is_admin === true || thread.author_id === user.id;
  if (!canDelete) {
    return { error: "削除する権限がありません。" };
  }

  const { error } = await supabase
    .from("discussion_threads")
    .delete()
    .eq("id", threadId);

  if (error) return { error: error.message };

  revalidatePath("/threads");
  redirect("/threads");
}

export async function deleteDiscussionPost(
  postId: string,
): Promise<{ error?: string; success?: string }> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase が未設定です。" };
  }

  const admin = await isCurrentUserAdmin();
  if (!admin) {
    return { error: "削除する権限がありません。" };
  }

  const supabase = await createClient();
  const { data: post, error: fetchError } = await supabase
    .from("discussion_posts")
    .select("id, thread_id")
    .eq("id", postId)
    .maybeSingle();

  if (fetchError || !post) {
    return { error: "コメントが見つかりません。" };
  }

  const { error } = await supabase
    .from("discussion_posts")
    .delete()
    .eq("id", postId);

  if (error) return { error: error.message };

  revalidatePath(`/threads/${post.thread_id}`);
  return { success: "削除しました。" };
}
