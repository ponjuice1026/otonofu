"use client";

import { useState, useTransition } from "react";
import { deleteDiscussionPost } from "@/app/threads/actions";

type DeletePostButtonProps = {
  postId: string;
};

export function DeletePostButton({ postId }: DeletePostButtonProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (!confirm("このコメントを削除しますか？（管理者）")) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteDiscussionPost(postId);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded border border-red-500/40 px-2 py-0.5 text-xs text-red-300 transition hover:border-red-400 hover:text-red-200 disabled:opacity-50"
      >
        {pending ? "削除中…" : "削除"}
      </button>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
