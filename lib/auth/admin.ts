import { getProfile } from "@/lib/auth/profile";
import { getUser } from "@/lib/auth/session";

export async function isCurrentUserAdmin(): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;

  const profile = await getProfile(user.id);
  return profile?.is_admin === true;
}
