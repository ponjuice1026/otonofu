import Link from "next/link";
import { getUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function ThreadCreateLink() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const user = await getUser();

  if (user) {
    return (
      <Link href="/threads/new" className="btn-primary shrink-0 px-3 py-2 text-sm sm:px-4">
        ＋ セッションを作成
      </Link>
    );
  }

  return (
    <Link
      href="/login?redirect=/threads/new"
      className="btn-secondary shrink-0 px-3 py-2 text-sm sm:px-4"
    >
      セッションを作成
    </Link>
  );
}
