"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
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
import { computeThreadLocalId, jstDateKey } from "@/lib/threads/thread-id";
import { resolveThreadIdSalt } from "@/lib/threads/thread-id-salt";
import { computeIpHashFromForwardedFor } from "@/lib/threads/ip-hash";
import { registerThreadParticipant } from "@/lib/data/poll-participants";
import { buildViewOnlyPollOptionInput } from "@/lib/threads/poll-defaults";
import { createNotification } from "@/lib/data/notify";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { checkContent } from "@/lib/moderation";

export type ThreadActionState = {
  error?: string;
  success?: string;
  votedOptionId?: string;
};

/**
 * 挿入系 security definer RPC（create_discussion_post /
 * vote_discussion_poll など）が投げる英語の例外メッセージを、
 * 既存の日本語エラー文言にマップする（A-2）。
 */
function mapInsertRpcError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("rate limit exceeded")) {
    return RATE_LIMIT_MESSAGE;
  }
  // NG ワード（banned word）は BAN（'banned'）より先に判定する。
  if (normalized.includes("banned word")) {
    return "投稿できない内容が含まれています。";
  }
  if (normalized.includes("banned")) {
    return "投稿が制限されています。";
  }
  if (normalized.includes("too many urls")) {
    return "URL が多すぎます。数を減らして再度お試しください。";
  }
  // 'thread locked' は 'thread not found' より先に判定する（部分一致で
  // 'not found' 系に巻き込まれないように、より具体的な文言を先に見る）。
  if (normalized.includes("thread locked")) {
    return "このセッションは凍結されています。";
  }
  if (normalized.includes("thread not found")) {
    return "セッションが見つかりません。";
  }
  if (normalized.includes("option not found")) {
    return "選択肢が見つかりません。";
  }
  if (normalized.includes("parent post not found")) {
    return "返信先のコメントが見つかりません。";
  }
  if (
    normalized.includes("invalid post body") ||
    normalized.includes("invalid anonymous name") ||
    normalized.includes("invalid voter key")
  ) {
    return "投稿内容を確認してください。";
  }

  return message;
}

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
    // カテゴリは任意。未選択（空文字）は null（未分類）として扱う。
    // 不正な値は FK 制約で弾かれる。
    const categoryIdRaw = String(formData.get("categoryId") ?? "").trim();
    const categoryId = categoryIdRaw.length > 0 ? categoryIdRaw : null;
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

      // モデレーション（本文の構造的スパム検査）
      const moderationError = checkContent(bodyRaw);
      if (moderationError) return { error: moderationError };

      // レート制限（新規作成の公開時のみ。既存下書きの編集公開は threadId 有り）
      if (!threadId) {
        const allowed = await checkRateLimit("thread_create", {
          dedupBody: normalizeThreadBody(bodyRaw),
        });
        if (!allowed) return { error: RATE_LIMIT_MESSAGE };
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
          category_id: categoryId,
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
          category_id: categoryId,
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

  const moderationError = checkContent(bodyRaw);
  if (moderationError) return { error: moderationError };

  // レート制限・重複投稿チェックは挿入 RPC(create_discussion_post)内部で
  // check_rate_limit() を呼んで一元的に行う（A-2）。ここで別途 checkRateLimit を
  // 呼ぶと同一 key・本文が二重計上され、RPC 側の dedup と衝突するため呼ばない。
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
  let parentAuthorId: string | null = null;
  if (replyToRaw) {
    const { data: parent, error: parentError } = await supabase
      .from("discussion_posts")
      .select("id, thread_id, author_id")
      .eq("id", replyToRaw)
      .maybeSingle();

    if (parentError || !parent || parent.thread_id !== threadId) {
      return { error: "返信先のコメントが見つかりません。" };
    }
    parentPostId = parent.id;
    parentAuthorId = parent.author_id ?? null;
  }

  // 5ch 式スレ内ID をサーバー側で計算する（生 key は DB に渡さない）。
  // 匿名は voter_key、ログインは user_id を identityKey に用いる。
  const voterKey = await getOrCreateVoterKey();
  const identityKey = user ? `user:${user.id}` : `voter:${voterKey}`;
  const threadLocalId = computeThreadLocalId({
    identityKey,
    threadId,
    jstDate: jstDateKey(new Date()),
    salt: resolveThreadIdSalt(),
  });

  // 挿入は security definer RPC 経由（DB 直叩きバイパス防止 / A-2）。
  // RPC 内部でもレート制限・URL 数モデレーションを再チェックする（多層防御）。
  // author_id は RPC 内で auth.uid() を用いてセットする（クライアント詐称不可）。
  const { data: insertedId, error } = await supabase.rpc(
    "create_discussion_post",
    {
      target_thread_id: threadId,
      post_body: normalizePostBody(bodyRaw),
      post_anonymous_name: displayName,
      voter_key: voterKey,
      parent_post_id: parentPostId,
      dedup_body: normalizePostBody(bodyRaw),
      // ログインユーザーが匿名表示を選んだ場合のみ true。未ログインは匿名だが
      // author_id が入らないため公開履歴には元々出ない（false のままで問題ない）。
      post_is_anonymous: Boolean(user && postAnonymously),
      post_thread_local_id: threadLocalId,
    },
  );

  if (error) {
    return { error: mapInsertRpcError(error.message) };
  }

  const inserted = insertedId ? { id: insertedId as string } : null;

  await registerThreadParticipant(threadId);

  // 通知。author_id が入ったため返信先投稿者への通知も可能になった。
  // - 返信(parent あり): 親レスの投稿者へ post_reply。
  // - スレ主へ: 返信でない場合は thread_reply。
  // 自分自身宛・重複は createNotification / RPC 側でスキップされる。
  try {
    const { data: thread } = await supabase
      .from("discussion_threads")
      .select("author_id")
      .eq("id", threadId)
      .maybeSingle();

    const threadAuthorId = thread?.author_id ?? null;

    // 返信先の投稿者へ通知（親がスレ主本人＝この後のスレ主通知と重複する場合は
    // スレ主通知側をスキップして二重通知を防ぐ）。
    if (parentPostId && parentAuthorId) {
      await createNotification({
        targetUserId: parentAuthorId,
        type: "post_reply",
        actorName: displayName,
        threadId,
        postId: inserted?.id ?? null,
      });
    }

    // スレ主へ通知。ただし返信先＝スレ主本人へ既に通知済みなら重複を避ける。
    const alreadyNotifiedThreadAuthor =
      Boolean(parentPostId) &&
      parentAuthorId !== null &&
      parentAuthorId === threadAuthorId;

    if (threadAuthorId && !alreadyNotifiedThreadAuthor) {
      await createNotification({
        targetUserId: threadAuthorId,
        type: parentPostId ? "post_reply" : "thread_reply",
        actorName: displayName,
        threadId,
        postId: inserted?.id ?? null,
      });
    }
  } catch (notifyErr) {
    console.error("[notify] createDiscussionPost:", notifyErr);
  }

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

  // レート制限は vote_discussion_poll RPC 内部で行う（A-2）。
  // 挿入は security definer RPC 経由（DB 直叩きバイパス防止）。
  const voterKey = await getOrCreateVoterKey();

  // cookie依存の緩和（B-3）: x-forwarded-for の先頭IPを salt 付き sha256 で
  // ハッシュ化し、同一スレ・同一IPハッシュからの重複投票も DB 側の部分
  // ユニーク制約で抑止する。生IPはログ・DBに残さない。IP が取得できない
  // 環境（ローカル開発等）では null のまま渡し、voter_key のみで判定する。
  const headersList = await headers();
  const forwardedFor = headersList.get("x-forwarded-for");
  const ipHash = computeIpHashFromForwardedFor(
    forwardedFor,
    resolveThreadIdSalt(),
  );

  const { error } = await supabase.rpc("vote_discussion_poll", {
    target_thread_id: threadId,
    target_option_id: optionId,
    voter_key: voterKey,
    target_ip_hash: ipHash,
  });

  if (error) {
    // 二重投票（unique 制約違反 23505）は専用メッセージに。
    // voter_key 由来(thread_id, voter_key)か ip_hash 由来
    // (thread_id, ip_hash 部分ユニーク)かは区別せず、同一メッセージにまとめる
    // （IP 共有環境での誤検知を過度に強調しないため）。
    if (error.code === "23505" || /duplicate key|23505/i.test(error.message)) {
      return { error: "このセッションにはすでに投票済みです。" };
    }
    return { error: mapInsertRpcError(error.message) };
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

  const moderationError = checkContent(pollOptions[0]?.label ?? "");
  if (moderationError) return { error: moderationError };

  const allowed = await checkRateLimit("post_create", {
    dedupBody: pollOptions[0]?.label ?? undefined,
  });
  if (!allowed) return { error: RATE_LIMIT_MESSAGE };

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

  const supabase = await createClient();
  const { data: post, error: fetchError } = await supabase
    .from("discussion_posts")
    .select("id, thread_id, author_id")
    .eq("id", postId)
    .maybeSingle();

  if (fetchError || !post) {
    return { error: "コメントが見つかりません。" };
  }

  // 「自分のレス or 管理者」を許可する。author_id が入ったレスのみ本人削除可。
  const user = await getUser();
  const isOwner = Boolean(
    user && post.author_id && post.author_id === user.id,
  );
  const admin = await isCurrentUserAdmin();
  if (!isOwner && !admin) {
    return { error: "削除する権限がありません。" };
  }

  const { error } = await supabase
    .from("discussion_posts")
    .delete()
    .eq("id", postId);

  if (error) return { error: error.message };

  revalidatePath(`/threads/${post.thread_id}`);
  return { success: "削除しました。" };
}

// ---------------------------------------------------------------------------
// スレ凍結（管理者専用）（監査 D-3）
//   新規投稿・投票の停止は create_discussion_post / vote_discussion_poll
//   RPC 側（add_thread_lock.sql）で強制する。ここは凍結フラグの更新のみ。
// ---------------------------------------------------------------------------

export async function lockThread(
  threadId: string,
  reason?: string,
): Promise<{ error?: string; success?: string }> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase が未設定です。" };
  }

  const admin = await isCurrentUserAdmin();
  if (!admin) {
    return { error: "管理者権限が必要です。" };
  }

  if (!threadId) {
    return { error: "セッション ID が不正です。" };
  }

  const trimmedReason = reason?.trim() || null;
  if (trimmedReason && trimmedReason.length > 200) {
    return { error: "凍結理由は200字以内で入力してください。" };
  }

  const supabase = await createClient();
  // DB 側 RPC（lock_discussion_thread）でも current_user_is_admin() を
  // 強制する（多層防御）。RPC 内部で auth.uid() を locked_by に使う。
  const { error } = await supabase.rpc("lock_discussion_thread", {
    target_thread_id: threadId,
    reason: trimmedReason,
  });

  if (error) {
    if (error.message.toLowerCase().includes("thread not found")) {
      return { error: "セッションが見つかりません。" };
    }
    if (error.message.toLowerCase().includes("admin required")) {
      return { error: "管理者権限が必要です。" };
    }
    return { error: error.message };
  }

  revalidatePath(`/threads/${threadId}`);
  revalidatePath("/threads");
  revalidatePath("/admin");
  return { success: "セッションを凍結しました。" };
}

export async function unlockThread(
  threadId: string,
): Promise<{ error?: string; success?: string }> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase が未設定です。" };
  }

  const admin = await isCurrentUserAdmin();
  if (!admin) {
    return { error: "管理者権限が必要です。" };
  }

  if (!threadId) {
    return { error: "セッション ID が不正です。" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("unlock_discussion_thread", {
    target_thread_id: threadId,
  });

  if (error) {
    if (error.message.toLowerCase().includes("thread not found")) {
      return { error: "セッションが見つかりません。" };
    }
    if (error.message.toLowerCase().includes("admin required")) {
      return { error: "管理者権限が必要です。" };
    }
    return { error: error.message };
  }

  revalidatePath(`/threads/${threadId}`);
  revalidatePath("/threads");
  revalidatePath("/admin");
  return { success: "凍結を解除しました。" };
}
