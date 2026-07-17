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
    <div className="page-shell mx-auto max-w-3xl">
      <header className="page-header flex items-center justify-between gap-3">
        <h1 className="page-title">通知</h1>
        {hasUnread && <MarkAllReadButton />}
      </header>

      {notifications.length === 0 ? (
        <p className="empty-state">通知はまだありません。</p>
      ) : (
        <NotificationList notifications={notifications} />
      )}
    </div>
  );
}
