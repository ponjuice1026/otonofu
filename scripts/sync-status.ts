/**
 * 同期キューと DB の状態を確認
 * 実行: npm run sync:status
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
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

  const { data: queue } = await supabase
    .from("artist_sync_queue")
    .select("status");

  const counts: Record<string, number> = {};
  for (const row of queue ?? []) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }

  const { count: artistCount } = await supabase
    .from("artists")
    .select("id", { count: "exact", head: true });
  const { count: albumCount } = await supabase
    .from("albums")
    .select("id", { count: "exact", head: true });

  const { data: albumsWithTracks } = await supabase
    .from("albums")
    .select("tracks");
  const tracksFilled = (albumsWithTracks ?? []).filter((row) => {
    const tracks = row.tracks;
    return Array.isArray(tracks) && tracks.length > 0;
  }).length;
  const tracksMissing = (albumsWithTracks?.length ?? 0) - tracksFilled;

  console.log("📊 キュー:");
  console.log(`   pending  ${counts.pending ?? 0}`);
  console.log(`   syncing  ${counts.syncing ?? 0}`);
  console.log(`   done     ${counts.done ?? 0}`);
  console.log(`   failed   ${counts.failed ?? 0}`);
  console.log(`   skipped  ${counts.skipped ?? 0}`);
  console.log("");
  console.log("💾 DB:");
  console.log(`   artists       ${artistCount ?? 0}`);
  console.log(`   albums        ${albumCount ?? 0}`);
  console.log(`   tracks 登録済 ${tracksFilled}`);
  console.log(`   tracks 未登録 ${tracksMissing}`);

  const { data: failed } = await supabase
    .from("artist_sync_queue")
    .select("name, attempts, last_error")
    .eq("status", "failed")
    .order("updated_at", { ascending: false })
    .limit(5);

  if ((failed?.length ?? 0) > 0) {
    console.log("");
    console.log("⚠️ 直近の失敗:");
    for (const row of failed!) {
      console.log(
        `   - ${row.name} (試行 ${row.attempts}): ${row.last_error?.slice(0, 80) ?? ""}`,
      );
    }
  }

  const { data: doneRecent } = await supabase
    .from("artist_sync_queue")
    .select("name, synced_at")
    .eq("status", "done")
    .order("synced_at", { ascending: false })
    .limit(5);

  if ((doneRecent?.length ?? 0) > 0) {
    console.log("");
    console.log("✅ 直近の完了:");
    for (const row of doneRecent!) {
      console.log(`   - ${row.name} (${row.synced_at?.slice(0, 16) ?? ""})`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
