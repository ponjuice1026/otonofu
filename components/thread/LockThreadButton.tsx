"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { lockThread, unlockThread } from "@/app/threads/actions";

type LockThreadButtonProps = {
  threadId: string;
  isLocked: boolean;
};

export function LockThreadButton({
  threadId,
  isLocked,
}: LockThreadButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [reason, setReason] = useState("");

  function handleLock() {
    setError(null);
    startTransition(async () => {
      const result = await lockThread(threadId, reason || undefined);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setShowReasonInput(false);
      setReason("");
      router.refresh();
    });
  }

  function handleUnlock() {
    if (!confirm("このセッションの凍結を解除しますか？")) return;
    setError(null);
    startTransition(async () => {
      const result = await unlockThread(threadId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (isLocked) {
    return (
      <div className="mt-3 flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={handleUnlock}
          disabled={pending}
          className="rounded-md border border-sky-500/40 px-3 py-1 text-xs text-sky-300 transition hover:border-sky-400 hover:text-sky-200 disabled:opacity-50"
        >
          {pending ? "解除中…" : "凍結を解除（管理者）"}
        </button>
        {error && <p className="text-xs text-red-300">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col items-end gap-1">
      {showReasonInput ? (
        <div className="flex flex-col items-end gap-2 rounded-md border border-[var(--brand-amber)]/30 bg-[var(--surface-raised)] p-2">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
            placeholder="凍結理由（任意）"
            className="input-field w-56 px-2 py-1 text-xs"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowReasonInput(false)}
              className="rounded-md border border-[var(--border-strong)] px-2.5 py-1 text-xs text-[var(--muted-foreground)] transition hover:border-[var(--border-strong)]"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleLock}
              disabled={pending}
              className="rounded-md border border-[var(--brand-amber)]/40 px-2.5 py-1 text-xs text-[var(--brand-amber)] transition hover:border-[var(--brand-amber)] hover:text-[var(--brand-amber)] disabled:opacity-50"
            >
              {pending ? "凍結中…" : "凍結する"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowReasonInput(true)}
          disabled={pending}
          className="rounded-md border border-[var(--brand-amber)]/40 px-3 py-1 text-xs text-[var(--brand-amber)] transition hover:border-[var(--brand-amber)] hover:text-[var(--brand-amber)] disabled:opacity-50"
        >
          凍結する（管理者）
        </button>
      )}
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
