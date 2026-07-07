"use client";

import { useState, useTransition } from "react";
import { unbanAction } from "@/app/admin/actions";
import { formatThreadDate } from "@/lib/threads/format";
import type { BanRow } from "@/lib/data/bans";

type Props = {
  ban: BanRow;
};

export function BanRowItem({ ban }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  const isExpired = ban.expiresAt !== null && new Date(ban.expiresAt) <= new Date();

  function handleUnban() {
    if (!confirm("この BAN を解除しますか？")) return;

    setError(null);
    startTransition(async () => {
      const result = await unbanAction(ban.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      setRemoved(true);
    });
  }

  if (removed) {
    return (
      <tr className="border-b border-zinc-800/50">
        <td colSpan={5} className="px-3 py-3 text-xs text-zinc-500">
          解除しました。
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-zinc-800/50 align-top">
      <td className="px-3 py-3">
        <span className="inline-block rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">
          {ban.subjectType === "user" ? "ユーザー" : "匿名"}
        </span>
        {isExpired && (
          <span className="ml-2 rounded bg-zinc-700/60 px-1.5 py-0.5 text-xs text-zinc-400">
            期限切れ
          </span>
        )}
        <p className="mt-1 break-all font-mono text-xs text-zinc-300">
          {ban.subjectKey}
        </p>
      </td>
      <td className="max-w-xs px-3 py-3 text-xs text-zinc-400">
        {ban.reason?.trim() || "—"}
      </td>
      <td className="px-3 py-3 text-xs text-zinc-500">
        {formatThreadDate(ban.createdAt)}
      </td>
      <td className="px-3 py-3 text-xs text-zinc-500">
        {ban.expiresAt ? formatThreadDate(ban.expiresAt) : "無期限"}
      </td>
      <td className="px-3 py-3 text-right">
        <button
          type="button"
          onClick={handleUnban}
          disabled={pending}
          className="rounded-md border border-zinc-600 px-2.5 py-1 text-xs text-zinc-300 transition hover:border-amber-500/50 hover:text-amber-300 disabled:opacity-50"
        >
          {pending ? "処理中…" : "解除"}
        </button>
        {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
      </td>
    </tr>
  );
}
