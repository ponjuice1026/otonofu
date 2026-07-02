"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  createDiscussionPost,
  type ThreadActionState,
} from "@/app/threads/actions";

type ThreadPostFormProps = {
  threadId: string;
  variant?: "inline" | "compose";
  replyToPostId?: string | null;
  replyToName?: string | null;
  isLoggedIn?: boolean;
  defaultDisplayName?: string | null;
  onCancelReply?: () => void;
  onPosted: () => void;
};

const initialState: ThreadActionState = {};

export function ThreadPostForm({
  threadId,
  variant = "compose",
  replyToPostId = null,
  replyToName = null,
  isLoggedIn = false,
  defaultDisplayName = null,
  onCancelReply,
  onPosted,
}: ThreadPostFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [postAnonymously, setPostAnonymously] = useState(false);
  const [state, formAction, pending] = useActionState(
    createDiscussionPost,
    initialState,
  );

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      setPostAnonymously(false);
      onPosted();
      router.refresh();
    }
  }, [state.success, router, onPosted]);

  const isInline = variant === "inline";
  const isFixedReply = isInline && replyToPostId !== null;
  const showAnonymousFields = !isLoggedIn || postAnonymously;
  const resolvedDisplayName = defaultDisplayName?.trim() || "ユーザー";

  return (
    <form
      ref={formRef}
      action={formAction}
      className={`flex flex-col gap-3 ${isInline ? "reddit-comment__compose rounded-md border border-zinc-700/70 bg-zinc-950/50 p-3" : ""}`}
    >
      <input type="hidden" name="threadId" value={threadId} />
      {isFixedReply && (
        <input type="hidden" name="parentPostId" value={replyToPostId} />
      )}

      {isFixedReply ? (
        <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
          <span>
            <span className="font-semibold text-zinc-300">
              {replyToName ?? "コメント"}
            </span>
            への返信
          </span>
          {onCancelReply && (
            <button
              type="button"
              onClick={onCancelReply}
              className="font-semibold text-zinc-400 transition hover:text-zinc-200"
            >
              キャンセル
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">
          {isLoggedIn
            ? "このセッションにコメントを投稿できます。"
            : "ログイン不要。匿名（名無し）で投稿できます。"}
        </p>
      )}

      {isLoggedIn && (
        <div className="flex flex-col gap-2">
          {!postAnonymously && (
            <p className={`text-zinc-400 ${isInline ? "text-xs" : "text-sm"}`}>
              投稿者名:{" "}
              <span className="font-medium text-zinc-200">
                {resolvedDisplayName}
              </span>
            </p>
          )}
          <label
            className={`flex items-center gap-2 text-zinc-300 ${isInline ? "text-xs" : "text-sm"}`}
          >
            <input
              type="checkbox"
              name="postAnonymously"
              checked={postAnonymously}
              onChange={(event) => setPostAnonymously(event.target.checked)}
              className="accent-amber-500"
            />
            匿名で投稿する
          </label>
        </div>
      )}

      {showAnonymousFields && (
        <label className={`flex flex-col gap-1 ${isInline ? "text-xs" : "text-sm"}`}>
          <span className="text-zinc-400">表示名（任意）</span>
          <input
            type="text"
            name="anonymousName"
            maxLength={24}
            placeholder="空欄で名無し"
            className={`rounded-md border border-zinc-700 bg-zinc-900 text-zinc-100 focus:border-amber-500/50 focus:outline-none ${
              isInline
                ? "px-3 py-1.5 text-sm"
                : "max-w-xs px-3 py-2"
            }`}
          />
        </label>
      )}

      <label className={`flex flex-col gap-1 ${isInline ? "text-xs" : "text-sm"}`}>
        {!isInline && <span className="text-zinc-400">コメント</span>}
        <textarea
          name="body"
          required
          rows={isInline ? 3 : 4}
          maxLength={4000}
          placeholder={
            isFixedReply
              ? "返信を書いてください"
              : "意見や質問を書いてください"
          }
          className="resize-y rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-amber-500/50 focus:outline-none"
        />
      </label>

      {state.error && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {state.success}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={`self-start rounded-md bg-amber-500 font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-60 ${
          isInline ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
        }`}
      >
        {pending ? "投稿中…" : isFixedReply ? "返信を投稿" : "投稿する"}
      </button>
    </form>
  );
}
