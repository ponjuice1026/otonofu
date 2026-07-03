import Link from "next/link";
import { getUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getUnreadNotificationCount } from "@/lib/data/notifications";

export async function NotificationBell() {
  if (!isSupabaseConfigured()) return null;

  const user = await getUser();
  if (!user) return null;

  const unread = await getUnreadNotificationCount(user.id);
  const badge = unread > 99 ? "99+" : String(unread);

  return (
    <Link
      href="/notifications"
      className="btn-ghost relative flex h-9 w-9 items-center justify-center p-0"
      aria-label={
        unread > 0 ? `通知（未読${unread}件）` : "通知"
      }
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-[18px] text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}
