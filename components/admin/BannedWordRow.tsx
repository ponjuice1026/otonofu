"use client";

import { useState, useTransition } from "react";
import { deleteBannedWordAction } from "@/app/admin/actions";
import { formatThreadDate } from "@/lib/threads/format";
import type { BannedWordRow } from "@/lib/data/moderation";

type Props = {
  word: BannedWordRow;
};

export function BannedWordRowItem({ word }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);

  function handleDelete() {
    if (!confirm(`NG ワード「${word.pattern}」を削除しますか？`)) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteBannedWordAction(word.id);
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
        <td colSpan={4} className="px-3 py-3 text-xs text-zinc-500">
          削除しました。
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-zinc-800/50 align-top">
      <td className="px-3 py-3">
        <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm text-zinc-200">
          {word.pattern}
        </code>
        {word.is_regex && (
          <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-400/90">
            正規表現
          </span>
        )}
      </td>
      <td className="max-w-xs px-3 py-3 text-xs text-zinc-400">
        {word.note?.trim() || "—"}
      </td>
      <td className="px-3 py-3 text-xs text-zinc-500">
        {formatThreadDate(word.createdAt)}
      </td>
      <td className="px-3 py-3 text-right">
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="rounded-md border border-red-500/40 px-2.5 py-1 text-xs text-red-300 transition hover:border-red-400 hover:text-red-200 disabled:opacity-50"
        >
          {pending ? "処理中…" : "削除"}
        </button>
        {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
      </td>
    </tr>
  );
}
