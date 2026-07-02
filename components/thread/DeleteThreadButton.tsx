"use client";

import { useState, useTransition } from "react";
import { deleteDiscussionThread } from "@/app/threads/actions";

type DeleteThreadButtonProps = {
  threadId: string;
  isAdmin: boolean;
};

export function DeleteThreadButton({
  threadId,
  isAdmin,
}: DeleteThreadButtonProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    const message = isAdmin
      ? "このセッションを削除しますか？（管理者）"
      : "このセッションを削除しますか？";
    if (!confirm(message)) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteDiscussionThread(threadId);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="mt-3 flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-md border border-red-500/40 px-3 py-1 text-xs text-red-300 transition hover:border-red-400 hover:text-red-200 disabled:opacity-50"
      >
        {pending ? "削除中…" : isAdmin ? "削除（管理者）" : "削除"}
      </button>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
