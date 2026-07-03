"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  approveContribution,
  rejectContribution,
} from "@/app/contribute/actions";
import { formatThreadDate } from "@/lib/threads/format";
import type { AdminContributionRow } from "@/lib/data/contributions";

type Props = {
  contribution: AdminContributionRow;
};

export function AdminContributionRowItem({ contribution }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [handled, setHandled] = useState(false);
  const [handledMessage, setHandledMessage] = useState("");

  function resolve(kind: "approve" | "reject") {
    const label = kind === "approve" ? "承認" : "却下";
    if (!confirm(`この申請を${label}しますか？`)) return;

    setError(null);
    startTransition(async () => {
      const action = kind === "approve" ? approveContribution : rejectContribution;
      const result = await action(contribution.id, note);
      if (result.error) {
        setError(result.error);
        return;
      }
      setHandledMessage(result.success ?? `${label}しました。`);
      setHandled(true);
    });
  }

  if (handled) {
    return (
      <tr className="border-b border-zinc-800/50">
        <td colSpan={4} className="px-3 py-3 text-xs text-zinc-500">
          {handledMessage}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-zinc-800/50 align-top">
      <td className="px-3 py-3">
        <span className="inline-block rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">
          {contribution.kindLabel}
        </span>
        {contribution.targetHref && contribution.targetLabel && (
          <p className="mt-2 text-xs text-zinc-500">
            対象:{" "}
            <Link
              href={contribution.targetHref}
              className="hover:text-amber-300"
            >
              {contribution.targetLabel}
            </Link>
          </p>
        )}
        {contribution.fields.length > 0 ? (
          <dl className="mt-2 flex flex-col gap-1">
            {contribution.fields.map((field, i) => (
              <div key={`${field.label}-${i}`} className="text-sm">
                <dt className="text-xs text-zinc-500">{field.label}</dt>
                <dd className="whitespace-pre-wrap text-zinc-200">
                  {field.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">（内容なし）</p>
        )}
      </td>
      <td className="px-3 py-3 text-sm text-zinc-300">
        {contribution.requesterName}
      </td>
      <td className="px-3 py-3 text-xs text-zinc-500">
        {formatThreadDate(contribution.createdAt)}
      </td>
      <td className="px-3 py-3 text-right">
        <div className="flex flex-col items-end gap-1.5">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="メモ（任意）"
            className="w-40 resize-y rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:border-amber-500/50 focus:outline-none"
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => resolve("approve")}
              disabled={pending}
              className="rounded-md border border-emerald-500/40 px-2.5 py-1 text-xs text-emerald-300 transition hover:border-emerald-400 hover:text-emerald-200 disabled:opacity-50"
            >
              {pending ? "処理中…" : "承認"}
            </button>
            <button
              type="button"
              onClick={() => resolve("reject")}
              disabled={pending}
              className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-50"
            >
              却下
            </button>
          </div>
        </div>
        {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
      </td>
    </tr>
  );
}
