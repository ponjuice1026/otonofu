/**
 * Spotify oEmbed で cover_url / image_url をバックフィル
 * 実行: npm run backfill:covers
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createAdminClient } from "../lib/supabase/admin";
import {
  fetchSpotifyOEmbedThumbnail,
  spotifyAlbumUrl,
  spotifyArtistUrl,
} from "../lib/spotify/oembed";

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

  const limit = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0");
  const delayMs = Number(process.argv.find((a) => a.startsWith("--delay="))?.split("=")[1] ?? "300");

  const supabase = createAdminClient();

  const { data: albums, error: albumsError } = await supabase
    .from("albums")
    .select("id, spotify_id, cover_url")
    .is("cover_url", null)
    .not("spotify_id", "is", null);

  if (albumsError) {
    console.error("albums:", albumsError.message);
    console.error("先に supabase/migrations/add_cover_urls.sql を実行してください。");
    process.exit(1);
  }

  const { data: artists, error: artistsError } = await supabase
    .from("artists")
    .select("id, spotify_id, image_url")
    .is("image_url", null)
    .not("spotify_id", "is", null);

  if (artistsError) {
    console.error("artists:", artistsError.message);
    process.exit(1);
  }

  const albumTargets = limit > 0 ? (albums ?? []).slice(0, limit) : (albums ?? []);
  const artistTargets = limit > 0 ? (artists ?? []).slice(0, Math.max(0, limit - albumTargets.length)) : (artists ?? []);

  console.log(`🎨 アルバム ${albumTargets.length} 件 / アーティスト ${artistTargets.length} 件`);

  let albumOk = 0;
  for (const album of albumTargets) {
    const url = await fetchSpotifyOEmbedThumbnail(spotifyAlbumUrl(album.spotify_id));
    if (url) {
      const { error } = await supabase
        .from("albums")
        .update({ cover_url: url })
        .eq("id", album.id);
      if (!error) albumOk += 1;
      else console.warn(`  ✗ ${album.id}: ${error.message}`);
    }
    await sleep(delayMs);
  }

  let artistOk = 0;
  for (const artist of artistTargets) {
    const url = await fetchSpotifyOEmbedThumbnail(spotifyArtistUrl(artist.spotify_id));
    if (url) {
      const { error } = await supabase
        .from("artists")
        .update({ image_url: url })
        .eq("id", artist.id);
      if (!error) artistOk += 1;
      else console.warn(`  ✗ ${artist.id}: ${error.message}`);
    }
    await sleep(delayMs);
  }

  console.log(`✅ 完了: アルバム ${albumOk}/${albumTargets.length}, アーティスト ${artistOk}/${artistTargets.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
