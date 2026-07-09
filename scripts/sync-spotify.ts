/**
 * Spotify → Supabase 同期スクリプト
 * 実行: npm run sync:spotify          … seeds.txt 全件
 *       npm run sync:spotify:batch    … seeds.txt 日次バッチ
 *       npm run sync:spotify:queue    … キューから N 件
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { runSpotifyQueueSync, runSpotifySync } from "../lib/spotify/run-sync";

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

function parseBatchSize(): number | undefined {
  const env = Number(process.env.SPOTIFY_SYNC_BATCH_SIZE);
  if (Number.isFinite(env) && env > 0) return env;

  const flagIndex = process.argv.indexOf("--limit");
  if (flagIndex >= 0) {
    const value = Number(process.argv[flagIndex + 1]);
    if (Number.isFinite(value) && value > 0) return value;
  }

  return undefined;
}

function printResult(result: Awaited<ReturnType<typeof runSpotifySync>>) {
  console.log(
    `\n✅ 完了 (${result.mode}): ${result.artistCount} 組 / ${result.albumCount} 件` +
      ` [${result.seedsProcessed}/${result.seedsTotal} 処理]`,
  );

  if (result.queue) {
    console.log(
      `📊 キュー: 残り pending ${result.queue.pending} / done ${result.queue.done} / failed ${result.queue.failed}`,
    );
  }

  if (result.errors.length > 0) {
    console.log("\n⚠️ 一部エラー:");
    result.errors.slice(0, 20).forEach((e) => console.log(`  - ${e}`));
    if (result.errors.length > 20) {
      console.log(`  …他 ${result.errors.length - 20} 件`);
    }
  }
}

async function main() {
  loadEnvLocal();

  const useQueue = process.argv.includes("--queue");
  const full = !process.argv.includes("--batch") && !useQueue;
  const batchSize = parseBatchSize();

  try {
    const result = useQueue
      ? await runSpotifyQueueSync({ batchSize: batchSize ?? 8 })
      : await runSpotifySync({ full, batchSize: batchSize ?? 5 });

    printResult(result);
    process.exit(0);
  } catch (err) {
    console.error(`❌ ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

main();
