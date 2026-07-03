import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getNotifications } from "@/lib/data/notifications";
import { pageTitle } from "@/lib/site";
import { NotificationList } from "@/components/layout/NotificationList";
import { MarkAllReadButton } from "@/components/layout/MarkAllReadButton";

export const dynamic = "force-dynamic";

export const metadata = {
  title: pageTitle("通知"),
};

export default async function NotificationsPage() {
  if (!isSupabaseConfigured()) {
    redirect("/login");
  }

  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  const notifications = await getNotifications(user.id);
  const hasUnread = notifications.some((n) => n.readAt === null);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-neutral-100">通知</h1>
        {hasUnread && <MarkAllReadButton />}
      </div>

      {notifications.length === 0 ? (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-10 text-center text-sm text-neutral-400">
          通知はまだありません。
        </p>
      ) : (
        <NotificationList notifications={notifications} />
      )}
    </main>
  );
}
