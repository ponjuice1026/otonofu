import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { User } from "@supabase/supabase-js";

export const getUser = cache(async (): Promise<User | null> => {
  if (!isSupabaseConfigured()) {
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
