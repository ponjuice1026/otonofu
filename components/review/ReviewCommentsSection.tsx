"use client";

import { useRouter } from "next/navigation";
import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  createReviewComment,
  deleteReviewComment,
  type ReviewCommentActionState,
} from "@/app/reviews/actions";
import { ReportButton } from "@/components/report/ReportButton";
import { UserLink } from "@/components/user/UserLink";
import { formatThreadDate } from "@/lib/threads/format";
import type { ReviewComment } from "@/lib/types";

type ReviewCommentsSectionProps = {
  reviewId: string;
  albumId: string;
  comments: ReviewComment[];
  isAdmin: boolean;
  currentUserId: string | null;
};

const initialState: ReviewCommentActionState = {};

export function ReviewCommentsSection({
  reviewId,
  albumId,
  comments,
  isAdmin,
  currentUserId,
}: ReviewCommentsSectionProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [replyTo, setReplyTo] = useState<ReviewComment | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [state, formAction, pending] = useActionState(
    createReviewComment,
    initialState,
  );

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      setReplyTo(null);
      router.refresh();
    }
  }, [state.success, router]);

  const handleReply = useCallback((comment: ReviewComment) => {
    setReplyTo((current) => (current?.id === comment.id ? null : comment));
    setExpanded(true);
    setTimeout(() => {
      textareaRef.current?.focus();
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 50);
  }, []);

  const handleJump = useCallback((index: number) => {
    const el = document.getElementById(
      `review-${reviewId}-comment-${index}`,
    );
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-amber-500/60");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-amber-500/60");
      }, 1600);
    }
  }, [reviewId]);

  const count = comments.length;

  return (
    <div ref={sectionRef} className="mt-3 border-t border-zinc-800 pt-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-xs text-zinc-400 transition hover:text-amber-300"
      >
        {expanded ? "コメントを閉じる" : `コメント ${count} 件を表示`}
      </button>

      {expanded && (
        <div className="mt-3 flex flex-col gap-3">
          {comments.length > 0 ? (
            <ol className="flex flex-col gap-2">
              {comments.map((comment) => {
                const isReplyTarget = replyTo?.id === comment.id;
                const canDelete =
                  isAdmin ||
                  (comment.authorId !== null &&
                    comment.authorId === currentUserId);

                return (
                  <li
                    key={comment.id}
                    id={`review-${reviewId}-comment-${comment.index}`}
                    className={`scroll-mt-4 rounded-md border bg-zinc-900/60 px-3 py-2 transition ${
                      isReplyTarget
                        ? "border-amber-500/60 bg-amber-500/5"
                        : "border-zinc-800"
                    }`}
                  >
                    <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-xs">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="font-medium text-zinc-300">
                          #{comment.index}{" "}
                          <UserLink
                            userId={comment.authorId}
                            name={comment.anonymousName}
                            className="transition hover:text-white"
                          />
                        </span>
                        <time className="text-zinc-500">
                          {formatThreadDate(comment.createdAt)}
                        </time>
                        {comment.parentIndex !== null && (
                          <button
                            type="button"
                            onClick={() => handleJump(comment.parentIndex!)}
                            className="rounded bg-zinc-800 px-1.5 py-0.5 text-amber-300 hover:bg-zinc-700"
                          >
                            → #{comment.parentIndex} に返信
                          </button>
                        )}
                      </div>
                      {canDelete && (
                        <DeleteCommentButton
                          commentId={comment.id}
                          albumId={albumId}
                        />
                      )}
                    </div>

                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
                      {comment.body}
                    </p>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <button
                        type="button"
                        onClick={() => handleReply(comment)}
                        className="text-zinc-400 transition hover:text-amber-300"
                      >
                        {isReplyTarget
                          ? "返信先（解除）"
                          : "このコメントに返信"}
                      </button>
                      <ReportButton
                        targetType="review_comment"
                        targetId={comment.id}
                      />
                      {comment.replyIndices.length > 0 && (
                        <span className="flex flex-wrap items-center gap-1 text-zinc-500">
                          <span>返信:</span>
                          {comment.replyIndices.map((idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleJump(idx)}
                              className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300 hover:bg-zinc-700"
                            >
                              #{idx}
                            </button>
                          ))}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-xs text-zinc-500">まだコメントはありません。</p>
          )}

          <form
            ref={formRef}
            action={formAction}
            className="flex flex-col gap-2 rounded-md border border-zinc-800 bg-zinc-900/40 p-3"
          >
            <input type="hidden" name="reviewId" value={reviewId} />
            <input type="hidden" name="albumId" value={albumId} />
            {replyTo && (
              <input
                type="hidden"
                name="parentCommentId"
                value={replyTo.id}
              />
            )}

            {replyTo ? (
              <div className="flex items-center justify-between rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-200">
                <span>
                  返信先: <span className="font-semibold">#{replyTo.index}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="rounded border border-amber-500/40 px-1.5 py-0.5 text-amber-200 transition hover:text-amber-100"
                >
                  キャンセル
                </button>
              </div>
            ) : null}

            <input
              type="text"
              name="anonymousName"
              maxLength={24}
              placeholder="表示名（任意・空欄で名無し）"
              className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 focus:border-amber-500/50 focus:outline-none"
            />
            <textarea
              ref={textareaRef}
              name="body"
              required
              rows={3}
              maxLength={2000}
              placeholder={
                replyTo
                  ? `#${replyTo.index} への返信を書いてください`
                  : "このレビューについてコメント"
              }
              className="resize-y rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 focus:border-amber-500/50 focus:outline-none"
            />

            {state.error && (
              <p className="rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-300">
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="self-start rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-60"
            >
              {pending
                ? "送信中…"
                : replyTo
                  ? "返信を投稿"
                  : "コメントする"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function DeleteCommentButton({
  commentId,
  albumId,
}: {
  commentId: string;
  albumId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!confirm("このコメントを削除しますか?")) return;
    startTransition(async () => {
      const result = await deleteReviewComment(commentId, albumId);
      if (result.error) {
        alert(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleDelete}
      className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-xs text-zinc-400 transition hover:border-red-500/50 hover:text-red-300 disabled:opacity-60"
    >
      {isPending ? "削除中…" : "削除"}
    </button>
  );
}
