"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Notification } from "@/lib/types";
import { formatThreadDate } from "@/lib/threads/format";
import { notificationMessage } from "@/lib/notifications/message";
import { markNotificationRead } from "@/app/notifications/actions";

type Props = {
  notifications: Notification[];
};

export function NotificationList({ notifications }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick(notification: Notification) {
    startTransition(async () => {
      if (notification.readAt === null) {
        await markNotificationRead(notification.id);
      }
      router.push(notification.href);
    });
  }

  return (
    <ul className="flex flex-col gap-2" aria-busy={isPending}>
      {notifications.map((notification) => {
        const unread = notification.readAt === null;
        return (
          <li key={notification.id}>
            <button
              type="button"
              onClick={() => handleClick(notification)}
              className={`flex w-full flex-col gap-1 rounded-lg border px-4 py-3 text-left transition-colors ${
                unread
                  ? "border-[var(--border-strong)] bg-[var(--surface-raised)] hover:border-white/40"
                  : "border-[var(--border)] bg-transparent hover:border-[var(--border-strong)]"
              }`}
            >
              <span className="flex items-center gap-2">
                {unread && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full bg-red-500"
                    aria-hidden
                  />
                )}
                <span
                  className={
                    unread
                      ? "text-sm font-semibold text-neutral-100"
                      : "text-sm text-neutral-300"
                  }
                >
                  {notificationMessage(notification.type, notification.actorName)}
                </span>
              </span>
              <span className="text-xs text-neutral-500">
                {formatThreadDate(notification.createdAt)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
