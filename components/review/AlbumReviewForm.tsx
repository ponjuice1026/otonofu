"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import {
  deleteAlbumReview,
  submitAlbumReview,
  type RatingActionState,
} from "@/app/albums/[id]/actions";
import { CriteriaRatingsInput } from "@/components/review/CriteriaRatingsInput";
import {
  criteriaFromReview,
  emptyCriteriaRatings,
  isCompleteCriteria,
} from "@/lib/ratings";
import type { Review } from "@/lib/types";

type AlbumReviewFormProps = {
  albumId: string;
  isLoggedIn: boolean;
  existingReview: Review | null;
};

const initialState: RatingActionState = {};

export function AlbumReviewForm({
  albumId,
  isLoggedIn,
  existingReview,
}: AlbumReviewFormProps) {
  const router = useRouter();
  const [criteria, setCriteria] = useState(() =>
    existingReview
      ? criteriaFromReview(existingReview)
      : emptyCriteriaRatings(),
  );
  const [body, setBody] = useState(existingReview?.body ?? "");
  const [createSession, setCreateSession] = useState(
    existingReview ? !existingReview.sessionOptOut : true,
  );
  const [state, formAction, pending] = useActionState(
    submitAlbumReview,
    initialState,
  );

  const [prevExistingReview, setPrevExistingReview] = useState(existingReview);
  if (existingReview !== prevExistingReview) {
    setPrevExistingReview(existingReview);
    setCriteria(
      existingReview
        ? criteriaFromReview(existingReview)
        : emptyCriteriaRatings(),
    );
    setBody(existingReview?.body ?? "");
    setCreateSession(existingReview ? !existingReview.sessionOptOut : true);
  }

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  if (!isLoggedIn) {
    return (
      <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <p className="text-sm text-zinc-400">
          アルバムを評価・レビューするには{" "}
          <Link href="/login" className="text-amber-400 hover:underline">
            ログイン
          </Link>{" "}
          してください。
        </p>
      </div>
    );
  }

  async function handleDelete() {
    if (!confirm("レビューを削除しますか？")) return;
    const result = await deleteAlbumReview(albumId);
    if (!result.error) {
      router.refresh();
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <h3 className="mb-3 text-sm font-semibold text-zinc-100">
        {existingReview ? "あなたのレビューを編集" : "このアルバムを評価"}
      </h3>
      <p className="mb-4 text-xs text-zinc-500">
        歌詞・音楽性・雰囲気・革新性を0〜10で評価し、平均が総合評価になります。
      </p>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="albumId" value={albumId} />

        <CriteriaRatingsInput
          value={criteria}
          onChange={setCriteria}
          disabled={pending}
        />

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-400">コメント（任意）</span>
          <textarea
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            disabled={pending}
            placeholder="このアルバムについて書いてみましょう…"
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-amber-500/50 focus:outline-none"
          />
        </label>

        <label className="flex items-start gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            name="createSession"
            checked={createSession}
            onChange={(event) => setCreateSession(event.target.checked)}
            disabled={pending}
            className="mt-0.5 accent-amber-500"
          />
          <span>
            レビューをセッションとして公開する
            <span className="mt-0.5 block text-xs text-zinc-500">
              チェックを外すと、他の人が議論できるセッションは作成されません。
            </span>
          </span>
        </label>

        {existingReview?.threadId && createSession && (
          <p className="text-xs text-zinc-500">
            公開中のセッション:{" "}
            <Link
              href={`/threads/${existingReview.threadId}`}
              className="text-amber-400 hover:underline"
            >
              セッションを見る
            </Link>
          </p>
        )}

        {state.error && (
          <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {state.error}
          </p>
        )}
        {state.success && (
          <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            {state.success}
            {state.threadId && (
              <>
                {" "}
                <Link
                  href={`/threads/${state.threadId}`}
                  className="font-medium underline"
                >
                  セッションを開く
                </Link>
              </>
            )}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={pending || !isCompleteCriteria(criteria)}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-60"
          >
            {pending ? "保存中…" : "レビューを保存"}
          </button>
          {existingReview && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-red-500/50 hover:text-red-300 disabled:opacity-60"
            >
              削除
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
