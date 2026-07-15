import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseAuthCookie } from "@/lib/auth/auth-cookie";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { User } from "@supabase/supabase-js";

export const getUser = cache(async (): Promise<User | null> => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  // 認証 Cookie が無い匿名リクエストでは auth.getUser()（認証サーバへの
  // ネットワーク往復）を呼ばずに null を返し、描画を軽くする。
  const cookieStore = await cookies();
  if (!hasSupabaseAuthCookie(cookieStore.getAll())) {
    return null;
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user;
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes("Dynamic server usage") ||
        ("digest" in err && err.digest === "DYNAMIC_SERVER_USAGE"))
    ) {
      throw err;
    }
    console.error("[auth] getUser:", err);
    return null;
  }
});
