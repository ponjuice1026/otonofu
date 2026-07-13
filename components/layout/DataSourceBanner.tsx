import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function DataSourceBanner() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="alert alert-warning border-b px-4 py-2 text-center text-xs">
        Supabase 未接続 — `.env.local` にキーを設定し、`supabase/schema.sql` を実行してから `npm run sync:spotify:sql` でデータを投入してください
      </div>
    );
  }

  let connectionErrorMessage: string | null = null;
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("artists").select("id").limit(1);
    connectionErrorMessage = error?.message ?? null;
  } catch {
    return null;
  }

  if (connectionErrorMessage) {
    return (
      <div className="alert alert-error border-b px-4 py-2 text-center text-xs">
        Supabase 接続エラー: {connectionErrorMessage}（テーブル作成済みか確認してください）
      </div>
    );
  }

  return null;
}
