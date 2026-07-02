"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  adminDeleteReportedContent,
  adminDismissReport,
} from "@/app/reports/actions";
import { formatThreadDate } from "@/lib/threads/format";
import type { AdminReportRow } from "@/lib/data/reports";

type Props = {
  report: AdminReportRow;
};

export function AdminReportRowItem({ report }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [handled, setHandled] = useState(false);
  const [handledMessage, setHandledMessage] = useState("");

  function handleDelete() {
    if (
      !confirm(
        "通報対象のコンテンツを削除しますか？同一コンテンツへの未処理の通報もすべて処理済みになります。",
      )
    ) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await adminDeleteReportedContent(report.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      setHandledMessage(result.success ?? "削除しました。");
      setHandled(true);
    });
  }

  function handleDismiss() {
    if (
      !confirm(
        "この通報を却下しますか？コンテンツは残り、同一コンテンツへの未処理の通報もすべて却下されます。",
      )
    ) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await adminDismissReport(report.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      setHandledMessage(result.success ?? "却下しました。");
      setHandled(true);
    });
  }

  if (handled) {
    return (
      <tr className="border-b border-zinc-800/50">
        <td colSpan={5} className="px-3 py-3 text-xs text-zinc-500">
          {handledMessage}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-zinc-800/50 align-top">
      <td className="px-3 py-3">
        <span className="inline-block rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">
          {report.targetLabel}
        </span>
        {report.reportCount > 1 && (
          <span className="ml-2 text-xs text-amber-300">
            同一 {report.reportCount} 件
          </span>
        )}
        <p className="mt-2 text-sm leading-relaxed text-zinc-200">
          {report.contentPreview}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          <Link href={report.contextHref} className="hover:text-amber-300">
            {report.contextLabel}
          </Link>
        </p>
      </td>
      <td className="px-3 py-3 text-sm text-zinc-300">{report.reasonLabel}</td>
      <td className="max-w-xs px-3 py-3 text-xs text-zinc-400">
        {report.details?.trim() || "—"}
      </td>
      <td className="px-3 py-3 text-xs text-zinc-500">
        {formatThreadDate(report.createdAt)}
      </td>
      <td className="px-3 py-3 text-right">
        <div className="flex flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="rounded-md border border-red-500/40 px-2.5 py-1 text-xs text-red-300 transition hover:border-red-400 hover:text-red-200 disabled:opacity-50"
          >
            {pending ? "処理中…" : "削除"}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            disabled={pending}
            className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-50"
          >
            却下
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
      </td>
    </tr>
  );
}
