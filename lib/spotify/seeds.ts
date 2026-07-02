import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SPOTIFY_ARTIST_SEEDS } from "@/lib/spotify/sync";

const SEEDS_PATH = resolve(process.cwd(), "data/spotify-seeds.txt");

/** data/spotify-seeds.txt があればそちらを優先、なければ sync.ts のリスト */
export function loadArtistSeeds(): string[] {
  if (!existsSync(SEEDS_PATH)) {
    return [...SPOTIFY_ARTIST_SEEDS];
  }

  const names = readFileSync(SEEDS_PATH, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  return names.length > 0 ? names : [...SPOTIFY_ARTIST_SEEDS];
}

/** 定期 Cron 用: 全シードを batchSize 件ずつローテーション */
export function pickArtistSeedBatch(
  seeds: string[],
  batchSize: number,
  batchIndex: number,
): string[] {
  if (seeds.length === 0 || batchSize <= 0) return [];
  if (batchSize >= seeds.length) return [...seeds];

  const start = (batchIndex * batchSize) % seeds.length;
  const batch: string[] = [];

  for (let i = 0; i < batchSize; i++) {
    batch.push(seeds[(start + i) % seeds.length]);
  }

  return batch;
}

export function batchIndexForToday(totalSeeds: number, batchSize: number): number {
  if (totalSeeds <= 0 || batchSize <= 0) return 0;
  const batches = Math.ceil(totalSeeds / batchSize);
  const day = Math.floor(Date.now() / 86_400_000);
  return day % batches;
}
