"use client";

import { useTransition } from "react";
import { markAllNotificationsRead } from "@/app/notifications/actions";

export function MarkAllReadButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await markAllNotificationsRead();
        })
      }
      className="btn-ghost text-sm disabled:opacity-50"
    >
      {isPending ? "処理中…" : "すべて既読にする"}
    </button>
  );
}
