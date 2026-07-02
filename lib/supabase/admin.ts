import { createClient, type SupabaseClientOptions } from "@supabase/supabase-js";

function adminClientOptions(): SupabaseClientOptions<"public"> {
  const auth = { persistSession: false, autoRefreshToken: false };

  if (typeof globalThis.WebSocket !== "undefined") {
    return { auth };
  }

  // Node.js 20 など WebSocket 非対応環境（GitHub Actions 等）
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const WebSocket = require("ws") as typeof globalThis.WebSocket;

  return {
    auth,
    realtime: { transport: WebSocket },
  };
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY が未設定です。Supabase Dashboard → Settings → API → service_role を .env.local に追加してください。",
    );
  }

  return createClient(url, key, adminClientOptions());
}
