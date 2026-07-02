import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { getProfile } from "@/lib/auth/profile";
import { getUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function BottomNav() {
  if (!isSupabaseConfigured()) {
    return <MobileBottomNav loggedIn={false} />;
  }

  const user = await getUser();

  if (!user) {
    return <MobileBottomNav loggedIn={false} accountLabel="ログイン" />;
  }

  const profile = await getProfile(user.id);
  const displayName =
    profile?.display_name?.trim() ||
    profile?.username ||
    user.email?.split("@")[0] ||
    "マイ";

  return (
    <MobileBottomNav
      loggedIn
      avatarUrl={profile?.avatar_url ?? undefined}
      accountLabel={displayName.length > 6 ? "マイ" : displayName}
    />
  );
}
