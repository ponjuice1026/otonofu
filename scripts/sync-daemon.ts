/**
 * Spotify 同期デーモン — ゆっくり継続稼働
 * 実行: npm run sync:daemon
 *
 * 1周ごとに:
 *   - キューからアーティスト 1 組 + アルバム + 収録曲を同期
 *   - 曲未登録のアルバムを 2 件バックフィル
 * 429 時は 5 分待機して再開
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  applySyncDaemonDefaults,
  runSyncDaemonLoop,
} from "../lib/spotify/sync-daemon";

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

function parseFlag(name: string): number | undefined {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  if (!arg) return undefined;
  const value = Number(arg.split("=")[1]);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

async function main() {
  loadEnvLocal();
  applySyncDaemonDefaults();

  await runSyncDaemonLoop({
    artistBatchSize: parseFlag("artist-batch"),
    trackBatchSize: parseFlag("track-batch"),
    cycleSleepMs: parseFlag("cycle-sleep"),
    idleSleepMs: parseFlag("idle-sleep"),
    rateLimitSleepMs: parseFlag("rate-limit-sleep"),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
