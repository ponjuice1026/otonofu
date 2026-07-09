"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { adminDeleteThread, setThreadFeatured } from "@/app/admin/actions";
import { lockThread, unlockThread } from "@/app/threads/actions";
import { formatThreadDate } from "@/lib/threads/format";
import type { AdminThreadRow } from "@/lib/data/admin";

type Props = {
  thread: AdminThreadRow;
};

export function AdminThreadRowItem({ thread }: Props) {
  const [pending, startTransition] = useTransition();
  const [featuredPending, startFeaturedTransition] = useTransition();
  const [lockPending, startLockTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [featuredError, setFeaturedError] = useState<string | null>(null);
  const [lockError, setLockError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [featuredRank, setFeaturedRank] = useState(thread.featuredRank);
  const [rankInput, setRankInput] = useState(
    String(thread.featuredRank ?? 0),
  );
  const [noteInput, setNoteInput] = useState(thread.featuredNote ?? "");
  const [isLocked, setIsLocked] = useState(thread.isLocked);

  function handleDelete() {
    if (!confirm(`「${thread.title}」を削除しますか？`)) return;
    setError(null);
    startTransition(async () => {
      const result = await adminDeleteThread(thread.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDeleted(true);
    });
  }

  function handleToggleFeatured() {
    setFeaturedError(null);
    if (featuredRank !== null) {
      startFeaturedTransition(async () => {
        const result = await setThreadFeatured(thread.id, null, null);
        if (result.error) {
          setFeaturedError(result.error);
          return;
        }
        setFeaturedRank(null);
        setNoteInput("");
      });
      return;
    }
    startFeaturedTransition(async () => {
      const rank = Number(rankInput) || 0;
      const result = await setThreadFeatured(thread.id, rank, noteInput);
      if (result.error) {
        setFeaturedError(result.error);
        return;
      }
      setFeaturedRank(rank);
    });
  }

  function handleSaveFeaturedDetails() {
    setFeaturedError(null);
    startFeaturedTransition(async () => {
      const rank = Number(rankInput) || 0;
      const result = await setThreadFeatured(thread.id, rank, noteInput);
      if (result.error) {
        setFeaturedError(result.error);
        return;
      }
      setFeaturedRank(rank);
    });
  }

  function handleToggleLock() {
    setLockError(null);
    if (isLocked) {
      startLockTransition(async () => {
        const result = await unlockThread(thread.id);
        if (result.error) {
          setLockError(result.error);
          return;
        }
        setIsLocked(false);
      });
      return;
    }
    const reason = window.prompt("凍結理由（任意・空欄可）") ?? undefined;
    startLockTransition(async () => {
      const result = await lockThread(thread.id, reason);
      if (result.error) {
        setLockError(result.error);
        return;
      }
      setIsLocked(true);
    });
  }

  if (deleted) {
    return (
      <tr className="border-b border-zinc-800/50">
        <td colSpan={5} className="px-3 py-3 text-xs text-zinc-500">
          削除しました: {thread.title}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-zinc-800/50 align-top">
      <td className="px-3 py-3">
        <Link
          href={`/threads/${thread.id}`}
          className="font-medium text-zinc-100 hover:text-amber-400"
        >
          {thread.title}
        </Link>
        <p className="mt-1 text-xs text-zinc-500">
          <span className="badge">
            {thread.kind === "album" ? "アルバム" : "議論"}
          </span>
          {isLocked && (
            <span className="badge ml-2 border-amber-500/40 text-amber-300">
              凍結中
            </span>
          )}
          <span className="ml-2">
            {thread.authorName} · {formatThreadDate(thread.createdAt)}
          </span>
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleToggleFeatured}
            disabled={featuredPending}
            className={
              featuredRank !== null
                ? "rounded-md border border-amber-500/40 px-2.5 py-1 text-xs text-amber-300 transition hover:border-amber-400 hover:text-amber-200 disabled:opacity-50"
                : "rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50"
            }
          >
            {featuredPending
              ? "更新中…"
              : featuredRank !== null
                ? "一押しを解除"
                : "一押しにする"}
          </button>
          <button
            type="button"
            onClick={handleToggleLock}
            disabled={lockPending}
            className={
              isLocked
                ? "rounded-md border border-sky-500/40 px-2.5 py-1 text-xs text-sky-300 transition hover:border-sky-400 hover:text-sky-200 disabled:opacity-50"
                : "rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50"
            }
          >
            {lockPending ? "更新中…" : isLocked ? "凍結を解除" : "凍結する"}
          </button>
        </div>
        {lockError && <p className="mt-1 text-xs text-red-300">{lockError}</p>}

        {featuredRank !== null && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="number"
              value={rankInput}
              onChange={(e) => setRankInput(e.target.value)}
              className="w-16 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
              aria-label="並び順"
            />
            <input
              type="text"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              maxLength={80}
              placeholder="一言メモ（任意・80字まで）"
              className="w-56 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
              aria-label="一言メモ"
            />
            <button
              type="button"
              onClick={handleSaveFeaturedDetails}
              disabled={featuredPending}
              className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50"
            >
              保存
            </button>
          </div>
        )}
        {featuredError && (
          <p className="mt-1 text-xs text-red-300">{featuredError}</p>
        )}
      </td>
      <td className="px-3 py-3 text-right text-sm text-zinc-300">
        {thread.viewCount.toLocaleString("ja-JP")}
      </td>
      <td className="px-3 py-3 text-right text-sm text-zinc-300">
        {thread.postCount}
      </td>
      <td className="px-3 py-3 text-right">
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="rounded-md border border-red-500/40 px-2.5 py-1 text-xs text-red-300 transition hover:border-red-400 hover:text-red-200 disabled:opacity-50"
        >
          {pending ? "削除中…" : "削除"}
        </button>
        {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
      </td>
    </tr>
  );
}
