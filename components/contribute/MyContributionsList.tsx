import {
  CONTRIBUTION_KIND_LABELS,
  CONTRIBUTION_STATUS_LABELS,
  CONTRIBUTION_PAYLOAD_LABELS,
} from "@/lib/contributions/constants";
import { formatThreadDate } from "@/lib/threads/format";
import type { ContributionRequest, ContributionStatus } from "@/lib/types";

type Props = {
  contributions: ContributionRequest[];
};

const STATUS_CLASS: Record<ContributionStatus, string> = {
  pending: "border-zinc-600 text-zinc-300",
  approved: "border-emerald-500/50 text-emerald-300",
  rejected: "border-rose-500/50 text-rose-300",
};

function summarize(payload: Record<string, unknown>): string {
  // 代表的な項目を優先して1行の要約にする
  for (const key of ["name", "detail", "artistName"]) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      const label = CONTRIBUTION_PAYLOAD_LABELS[key] ?? key;
      return `${label}: ${value.trim()}`;
    }
  }
  return "（内容なし）";
}

export function MyContributionsList({ contributions }: Props) {
  if (contributions.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        まだ申請はありません。アルバム・アーティストページの「情報の修正を依頼」や、
        検索結果の追加リクエストから申請できます。
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {contributions.map((c) => (
        <li
          key={c.id}
          className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-neutral-500">
              {CONTRIBUTION_KIND_LABELS[c.kind]}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_CLASS[c.status]}`}
            >
              {CONTRIBUTION_STATUS_LABELS[c.status]}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-neutral-200">
            {summarize(c.payload)}
          </p>
          {c.adminNote && (
            <p className="mt-1 text-xs text-amber-300/90">
              管理者メモ: {c.adminNote}
            </p>
          )}
          <p className="mt-2 text-xs text-neutral-500">
            申請 {formatThreadDate(c.createdAt)}
            {c.resolvedAt && ` · 処理 ${formatThreadDate(c.resolvedAt)}`}
          </p>
        </li>
      ))}
    </ul>
  );
}
