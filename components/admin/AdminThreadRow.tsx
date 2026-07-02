"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { adminDeleteThread } from "@/app/admin/actions";
import { formatThreadDate } from "@/lib/threads/format";
import type { AdminThreadRow } from "@/lib/data/admin";

type Props = {
  thread: AdminThreadRow;
};

export function AdminThreadRowItem({ thread }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);

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
          {thread.authorName} · {formatThreadDate(thread.createdAt)}
        </p>
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
