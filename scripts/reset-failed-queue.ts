/**
 * artist_sync_queue の failed 状態を pending に戻して再試行する
 * 実行: npm run sync:reset-failed
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();
  const { createAdminClient } = await import("../lib/supabase/admin");
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("artist_sync_queue")
    .update({
      status: "pending",
      last_error: null,
      attempts: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("status", "failed")
    .select("name");

  if (error) {
    console.error("更新失敗:", error.message);
    process.exit(1);
  }

  console.log(`✅ ${data?.length ?? 0} 件を pending に戻しました`);
  for (const row of data ?? []) {
    console.log(`   - ${row.name}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
