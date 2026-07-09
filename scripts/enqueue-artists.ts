/**
 * アーティストを同期キューに登録
 * 実行: npm run enqueue:artists
 *       npm run enqueue:artists -- data/artists-import.csv
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createAdminClient } from "../lib/supabase/admin";
import { enqueueArtists, getQueueStats, type EnqueueInput } from "../lib/spotify/queue";
import { loadArtistSeeds } from "../lib/spotify/seeds";
import { SPOTIFY_SEED_IDS } from "../lib/spotify/sync";

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

function parseCsv(content: string): EnqueueInput[] {
  const entries: EnqueueInput[] = [];

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const parts = trimmed.split(",").map((part) => part.trim());
    const name = parts[0];
    if (!name || name.toLowerCase() === "name") continue;

    const spotifyId = parts[1] || null;
    const priority = parts[2] ? Number(parts[2]) : 0;

    entries.push({
      name,
      spotify_id: spotifyId,
      priority: Number.isFinite(priority) ? priority : 0,
    });
  }

  return entries;
}

function seedsToEnqueueInputs(seeds: string[]): EnqueueInput[] {
  return seeds.map((name) => ({
    name,
    spotify_id: SPOTIFY_SEED_IDS[name] ?? null,
    priority: 0,
  }));
}

async function main() {
  loadEnvLocal();

  const requeueDone = process.argv.includes("--requeue-done");
  const fileArg = process.argv.find(
    (arg) => !arg.startsWith("-") && arg.endsWith(".csv"),
  );
  const filePath = fileArg
    ? resolve(process.cwd(), fileArg)
    : null;

  let entries: EnqueueInput[];

  if (filePath) {
    if (!existsSync(filePath)) {
      console.error(`❌ ファイルが見つかりません: ${filePath}`);
      process.exit(1);
    }
    entries = parseCsv(readFileSync(filePath, "utf8"));
    console.log(`📄 ${filePath} から ${entries.length} 件読み込み`);
  } else {
    entries = seedsToEnqueueInputs(loadArtistSeeds());
    console.log(`📄 spotify-seeds.txt から ${entries.length} 件読み込み`);
  }

  try {
    const supabase = createAdminClient();
    const result = await enqueueArtists(supabase, entries, { requeueDone });
    const stats = await getQueueStats(supabase);

    console.log(
      `\n✅ キュー登録: 追加 ${result.added} / 更新 ${result.updated} / スキップ ${result.skipped}`,
    );
    console.log(
      `📊 キュー状況: pending ${stats.pending} / done ${stats.done} / failed ${stats.failed} / 合計 ${stats.total}`,
    );
    process.exit(0);
  } catch (err) {
    console.error(`❌ ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

main();
