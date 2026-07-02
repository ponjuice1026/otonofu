/**
 * Spotify データを取得し、Supabase SQL Editor 用の upsert SQL を生成
 * 実行: npm run sync:spotify:sql
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { isSpotifyConfigured } from "../lib/spotify/env";
import {
  fetchSpotifyArtistByName,
  transformAlbum,
  transformArtist,
  type DbAlbumRow,
  type DbArtistRow,
} from "../lib/spotify/sync";
import { loadArtistSeeds } from "../lib/spotify/seeds";

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

function sqlString(value: string | null): string {
  if (value === null) return "null";
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlArray(values: string[]): string {
  if (values.length === 0) return "array[]::text[]";
  return `array[${values.map(sqlString).join(", ")}]`;
}

function sqlJson(value: unknown): string {
  return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
}

function artistValues(row: DbArtistRow): string {
  return `(${[
    sqlString(row.id),
    sqlString(row.name),
    sqlString(row.name_en),
    sqlString(row.origin),
    row.active_from,
    row.active_to ?? "null",
    sqlArray(row.genres),
    sqlString(row.bio),
    sqlJson(row.career),
    sqlString(row.spotify_id),
    sqlString(row.image_url),
  ].join(", ")})`;
}

function albumValues(row: DbAlbumRow): string {
  return `(${[
    sqlString(row.id),
    sqlString(row.title),
    sqlString(row.artist_id),
    row.year,
    sqlString(row.genre),
    sqlString(row.release_type),
    sqlString(row.cover_color),
    sqlString(row.cover_url),
    sqlJson(row.tracks ?? []),
    row.avg_rating,
    row.rating_count,
    sqlString(row.spotify_id),
  ].join(", ")})`;
}

async function main() {
  loadEnvLocal();

  if (!isSpotifyConfigured()) {
    console.error("❌ SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET を .env.local に設定してください。");
    process.exit(1);
  }

  const seeds = loadArtistSeeds();
  console.log(`🎵 ${seeds.length} 組のアーティストを Spotify から取得中...\n`);

  const artists: DbArtistRow[] = [];
  const albums: DbAlbumRow[] = [];
  const errors: string[] = [];

  for (const seed of seeds) {
    try {
      process.stdout.write(`  → ${seed} ... `);
      const result = await fetchSpotifyArtistByName(seed);
      if (!result) {
        console.log("見つかりませんでした");
        errors.push(`${seed}: 検索結果なし`);
        continue;
      }

      const { artist, albums: spotifyAlbums } = result;
      const artistRow = transformArtist(artist, spotifyAlbums, seed);
      artists.push(artistRow);

      const albumRows = spotifyAlbums
        .map((album) => transformAlbum(album, artistRow.id, artist.genres ?? []))
        .filter((row): row is DbAlbumRow => row !== null);

      albums.push(...albumRows);
      console.log(`OK（${artistRow.name} / ${albumRows.length} リリース）`);
    } catch (err) {
      console.log("エラー");
      errors.push(`${seed}: ${err instanceof Error ? err.message : String(err)}`);
    }

    await new Promise((r) => setTimeout(r, 1200));
  }

  const lines: string[] = [
    "-- Spotify 同期データ（Supabase Dashboard → SQL Editor で実行）",
    `-- 生成日時: ${new Date().toISOString()}`,
    `-- アーティスト ${artists.length} 組 / アルバム ${albums.length} 件`,
    "",
  ];

  if (artists.length > 0) {
    lines.push(
      "insert into public.artists (id, name, name_en, origin, active_from, active_to, genres, bio, career, spotify_id, image_url)",
      "values",
      artists.map(artistValues).join(",\n"),
      "on conflict (id) do update set",
      "  name = excluded.name,",
      "  name_en = excluded.name_en,",
      "  origin = excluded.origin,",
      "  active_from = excluded.active_from,",
      "  active_to = excluded.active_to,",
      "  genres = excluded.genres,",
      "  bio = excluded.bio,",
      "  career = excluded.career,",
      "  spotify_id = excluded.spotify_id,",
      "  image_url = excluded.image_url;",
      "",
    );
  }

  if (albums.length > 0) {
    lines.push(
      "insert into public.albums (id, title, artist_id, year, genre, release_type, cover_color, cover_url, tracks, avg_rating, rating_count, spotify_id)",
      "values",
      albums.map(albumValues).join(",\n"),
      "on conflict (id) do update set",
      "  title = excluded.title,",
      "  artist_id = excluded.artist_id,",
      "  year = excluded.year,",
      "  genre = excluded.genre,",
      "  release_type = excluded.release_type,",
      "  cover_color = excluded.cover_color,",
      "  cover_url = excluded.cover_url,",
      "  tracks = excluded.tracks,",
      "  spotify_id = excluded.spotify_id,",
      "  avg_rating = excluded.avg_rating,",
      "  rating_count = excluded.rating_count;",
      "",
    );
  }

  const outPath = resolve(process.cwd(), "supabase/migrations/sync_spotify_data.sql");
  writeFileSync(outPath, lines.join("\n"), "utf8");

  console.log(`\n✅ SQL を生成しました: ${outPath}`);
  console.log("   Supabase Dashboard → SQL Editor でこのファイルの内容を実行してください。");

  if (errors.length > 0) {
    console.log("\n⚠️ 一部エラー:");
    errors.forEach((e) => console.log(`  - ${e}`));
  }
}

main();
