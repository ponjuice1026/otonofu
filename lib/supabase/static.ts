import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "./env";

/**
 * Cookie を一切参照しない匿名（anon key）Supabase クライアント。
 *
 * `lib/supabase/server.ts` の `createClient()` は `cookies()` を読むため、
 * これを使うデータ取得は必ず動的レンダリングになり `unstable_cache` の
 * 中でも使えない（cookies/headers はキャッシュスコープ内で参照不可）。
 *
 * このクライアントは Cookie に触れないので、公開データ（アルバム・
 * アーティスト・集計など、匿名ユーザーにも見えるデータ）の取得を
 * `unstable_cache` でキャッシュする用途に使える。RLS は anon ロールとして
 * 適用されるため、ログイン前提のデータ取得には使わないこと。
 */
let cachedClient: SupabaseClient | null = null;

export function createStaticClient(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
    );
  }

  if (cachedClient) {
    return cachedClient;
  }

  cachedClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  return cachedClient;
}
