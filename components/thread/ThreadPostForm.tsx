"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  createDiscussionPost,
  type ThreadActionState,
} from "@/app/threads/actions";

/** 表示名が空欄のときの匿名投稿名（DBの normalizeAnonymousName と同じ既定値の説明用）。 */
const ANONYMOUS_FALLBACK_LABEL = "名無し";

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
  const [anonymousNameInput, setAnonymousNameInput] = useState("");
  const [state, formAction, pending] = useActionState(
    createDiscussionPost,
    initialState,
  );

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state.success) {
      setPostAnonymously(false);
      setAnonymousNameInput("");
    }
  }

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      onPosted();
      router.refresh();
    }
  }, [state.success, router, onPosted]);

  const isInline = variant === "inline";
  const isFixedReply = isInline && replyToPostId !== null;
  const showAnonymousFields = !isLoggedIn || postAnonymously;
  const resolvedDisplayName = defaultDisplayName?.trim() || "ユーザー";
  // 今この瞬間、実際にどの名前で投稿されるか（監査 D-5）。
  // ログイン + 匿名オフ: プロフィール名。それ以外: 入力中の表示名 or 名無し。
  const willPostAsAnonymous = !isLoggedIn || postAnonymously;
  const currentPostingName = willPostAsAnonymous
    ? anonymousNameInput.trim() || ANONYMOUS_FALLBACK_LABEL
    : resolvedDisplayName;

  return (
    <form
      ref={formRef}
      action={formAction}
      className={`flex flex-col gap-3 ${isInline ? "reddit-comment__compose rounded-md border border-[var(--border)] bg-[var(--surface)] p-3" : ""}`}
    >
      <input type="hidden" name="threadId" value={threadId} />
      {isFixedReply && (
        <input type="hidden" name="parentPostId" value={replyToPostId} />
      )}

      {isFixedReply ? (
        <div className="flex items-center justify-between gap-2 text-xs text-[var(--muted)]">
          <span>
            <span className="font-semibold text-[var(--muted-foreground)]">
              {replyToName ?? "コメント"}
            </span>
            への返信
          </span>
          {onCancelReply && (
            <button
              type="button"
              onClick={onCancelReply}
              className="font-semibold text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]"
            >
              キャンセル
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">
          {isLoggedIn
            ? "このセッションにコメントを投稿できます。"
            : "ログイン不要。匿名（名無し）で投稿できます。"}
        </p>
      )}

      {/* 今どの名前で投稿されるかを常に明示する（監査 D-5）。 */}
      <p
        className={`flex flex-wrap items-center gap-1.5 rounded-md border px-3 py-1.5 ${
          willPostAsAnonymous
            ? "border-[var(--border)] bg-[var(--surface-raised)]"
            : "border-[var(--brand-amber)]/30 bg-[var(--brand-amber-soft)]"
        } ${isInline ? "text-xs" : "text-sm"}`}
      >
        <span className="text-[var(--muted-foreground)]">
          {willPostAsAnonymous ? "匿名で投稿します:" : "投稿者名として投稿します:"}
        </span>
        <span
          className={`font-semibold ${willPostAsAnonymous ? "text-[var(--foreground)]" : "text-[var(--brand-amber)]"}`}
        >
          {currentPostingName}
        </span>
      </p>

      {isLoggedIn && (
        <label
          className={`flex items-center gap-2 text-[var(--muted-foreground)] ${isInline ? "text-xs" : "text-sm"}`}
        >
          <input
            type="checkbox"
            name="postAnonymously"
            checked={postAnonymously}
            onChange={(event) => setPostAnonymously(event.target.checked)}
            className="accent-[var(--brand-amber)]"
          />
          匿名（名無し）で投稿する
        </label>
      )}

      {showAnonymousFields && (
        <label className={`flex flex-col gap-1 ${isInline ? "text-xs" : "text-sm"}`}>
          <span className="text-[var(--muted-foreground)]">匿名の表示名（任意）</span>
          <input
            type="text"
            name="anonymousName"
            maxLength={24}
            placeholder="空欄で名無し"
            value={anonymousNameInput}
            onChange={(event) => setAnonymousNameInput(event.target.value)}
            className={`input-field ${
              isInline
                ? "px-3 py-1.5 text-sm"
                : "max-w-xs px-3 py-2"
            }`}
          />
        </label>
      )}

      <label className={`flex flex-col gap-1 ${isInline ? "text-xs" : "text-sm"}`}>
        {!isInline && <span className="text-[var(--muted-foreground)]">コメント</span>}
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
          className="input-field resize-y"
        />
      </label>

      {state.error && (
        <p className="alert alert-error text-sm">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="alert alert-success text-sm">
          {state.success}
        </p>
      )}

      {isInline ? (
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-md bg-[var(--brand-amber)] px-3 py-1.5 text-xs font-semibold text-[#1a1200] transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "投稿中…" : isFixedReply ? "返信を投稿" : "投稿する"}
        </button>
      ) : (
        <button type="submit" disabled={pending} className="btn-primary self-start">
          {pending ? "投稿中…" : isFixedReply ? "返信を投稿" : "投稿する"}
        </button>
      )}
    </form>
  );
}
