"use client";

import { useActionState, useEffect, useState } from "react";
import {
  submitContentReport,
  type ReportActionState,
} from "@/app/reports/actions";
import {
  getReportReasonOptions,
  type ContentReportTargetType,
} from "@/lib/reports/constants";

type ReportButtonProps = {
  targetType: ContentReportTargetType;
  targetId: string;
  className?: string;
  triggerLabel?: string;
  reportedLabel?: string;
  formTitle?: string;
  submitLabel?: string;
};

const initialState: ReportActionState = {};
const reasonOptions = getReportReasonOptions();

export function ReportButton({
  targetType,
  targetId,
  className = "",
  triggerLabel = "通報",
  reportedLabel = "通報済み",
  formTitle = "通報理由",
  submitLabel = "通報する",
}: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    submitContentReport,
    initialState,
  );

  useEffect(() => {
    if (state.success) {
      setOpen(false);
    }
  }, [state.success]);

  if (state.success && !open) {
    return (
      <span className={`text-xs text-zinc-500 ${className}`.trim()}>
        {reportedLabel}
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-xs text-zinc-500 transition hover:text-red-300 ${className}`.trim()}
      >
        {triggerLabel}
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className={`mt-2 w-full basis-full rounded-md border border-zinc-800 bg-zinc-950/80 p-3 ${className}`.trim()}
    >
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />

      <p className="mb-2 text-xs font-medium text-zinc-300">{formTitle}</p>
      <div className="mb-2 flex flex-col gap-1.5">
        {reasonOptions.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300"
          >
            <input
              type="radio"
              name="reason"
              value={option.value}
              required
              className="accent-amber-500"
            />
            {option.label}
          </label>
        ))}
      </div>

      <textarea
        name="details"
        rows={2}
        maxLength={500}
        placeholder="詳細（任意）"
        className="mb-2 w-full resize-y rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 focus:border-amber-500/50 focus:outline-none"
      />

      {state.error && (
        <p className="mb-2 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-300">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-red-500/40 px-2.5 py-1 text-xs text-red-300 transition hover:border-red-400 hover:text-red-200 disabled:opacity-60"
        >
          {pending ? "送信中…" : submitLabel}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setOpen(false)}
          className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 transition hover:text-zinc-200 disabled:opacity-60"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}
