/**
 * 既存アルバムの収録曲を Spotify から取得して DB に保存
 * 実行: npm run backfill:tracks
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createAdminClient } from "../lib/supabase/admin";
import { isSpotifyConfigured } from "../lib/spotify/env";
import { isSpotifyRateLimitError, spotifyFetchForPage } from "../lib/spotify/client";
import { mapSpotifyTracksToDb } from "../lib/spotify/tracks";
import type { SpotifyAlbumDetail } from "../lib/spotify/types";

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

function sleep(ms: number) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function main() {
  loadEnvLocal();

  if (!isSpotifyConfigured()) {
    console.error("Spotify が未設定です。");
    process.exit(1);
  }

  const limitArg = process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1];
  const limit = limitArg === "0" ? Number.MAX_SAFE_INTEGER : Number(limitArg ?? "50");
  const delayMs = Number(process.argv.find((a) => a.startsWith("--delay="))?.split("=")[1] ?? "1200");

  const supabase = createAdminClient();

  const { data: albums, error } = await supabase
    .from("albums")
    .select("id, title, spotify_id, tracks")
    .not("spotify_id", "is", null)
    .order("year", { ascending: false });

  if (error) {
    console.error(error.message);
    console.error("先に supabase/migrations/add_album_tracks.sql を実行してください。");
    process.exit(1);
  }

  const targets = (albums ?? [])
    .filter((album) => {
      const tracks = album.tracks;
      return !Array.isArray(tracks) || tracks.length === 0;
    })
    .slice(0, limit);

  console.log(`🎵 収録曲バックフィル: ${targets.length} 件`);

  let ok = 0;
  for (const album of targets) {
    try {
      const detail = await spotifyFetchForPage<SpotifyAlbumDetail>(
        `/albums/${album.spotify_id}`,
      );
      const tracks = mapSpotifyTracksToDb(detail.tracks.items);
      if (tracks.length === 0) continue;

      const { error: updateError } = await supabase
        .from("albums")
        .update({ tracks })
        .eq("id", album.id);

      if (updateError) {
        console.warn(`  ✗ ${album.title}: ${updateError.message}`);
      } else {
        ok += 1;
        console.log(`  ✓ ${album.title} (${tracks.length} 曲)`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`  ✗ ${album.title}: ${message}`);
      if (isSpotifyRateLimitError(message)) {
        console.warn("⏸️ Spotify 429 — 中断します。後で再実行してください。");
        break;
      }
    }

    await sleep(delayMs);
  }

  console.log(`✅ 完了: ${ok}/${targets.length} 件`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
