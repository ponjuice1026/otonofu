import Image from "next/image";
import Link from "next/link";
import { logout } from "@/app/login/actions";
import { isCurrentUserAdmin } from "@/lib/auth/admin";
import { getProfile } from "@/lib/auth/profile";
import { getUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function initialFor(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const cp = trimmed.codePointAt(0);
  return cp ? String.fromCodePoint(cp) : "?";
}

export async function HeaderAuth() {
  if (!isSupabaseConfigured()) {
    return (
      <Link href="/login" className="btn-ghost">
        ログイン
      </Link>
    );
  }

  const user = await getUser();

  if (!user) {
    return (
      <Link href="/login" className="btn-ghost">
        ログイン
      </Link>
    );
  }

  const [admin, profile] = await Promise.all([
    isCurrentUserAdmin(),
    getProfile(user.id),
  ]);

  const displayName =
    profile?.display_name?.trim() ||
    profile?.username ||
    user.email?.split("@")[0] ||
    "アカウント";

  return (
    <div className="flex items-center gap-2">
      {admin && (
        <Link
          href="/admin"
          className="btn-ghost border-white/20 text-neutral-200 hover:border-white/40"
        >
          管理
        </Link>
      )}
      <Link
        href="/profile"
        className="btn-ghost flex items-center gap-2 py-1 pl-1 pr-3"
      >
        <span className="relative block h-7 w-7 shrink-0 overflow-hidden rounded-full border border-[var(--border-strong)] bg-[var(--surface-raised)]">
          {profile?.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={displayName}
              fill
              className="object-cover"
              sizes="28px"
              unoptimized
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-sm font-bold text-neutral-400">
              {initialFor(displayName)}
            </span>
          )}
        </span>
        <span className="hidden max-w-[120px] truncate sm:inline">
          {displayName}
        </span>
        <span className="sm:hidden">プロフィール</span>
      </Link>
      <form action={logout}>
        <button type="submit" className="btn-ghost">
          ログアウト
        </button>
      </form>
    </div>
  );
}
