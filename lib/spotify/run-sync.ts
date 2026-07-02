import { isSpotifyRateLimitError, spotifyFetch } from "@/lib/spotify/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSpotifyConfigured } from "@/lib/spotify/env";
import {
  countQueuePending,
  fetchQueueBatch,
  getQueueStats,
  markQueueDone,
  markQueueFailed,
  markQueueSkipped,
  markQueueSyncing,
  recoverStuckQueueRows,
  releaseQueueRow,
  type QueueRow,
} from "@/lib/spotify/queue";
import {
  batchIndexForToday,
  loadArtistSeeds,
  pickArtistSeedBatch,
} from "@/lib/spotify/seeds";
import {
  fetchSpotifyArtist,
  transformAlbum,
  transformArtist,
  type DbAlbumRow,
} from "@/lib/spotify/sync";
import { mapSpotifyTracksToDb } from "@/lib/spotify/tracks";
import type { SpotifyAlbumDetail } from "@/lib/spotify/types";

export type SpotifySyncResult = {
  mode: "full" | "batch" | "queue";
  seedsTotal: number;
  seedsProcessed: number;
  artistCount: number;
  albumCount: number;
  errors: string[];
  processed: string[];
  queue?: {
    pending: number;
    done: number;
    failed: number;
  };
  rateLimited?: boolean;
};

type RunSpotifySyncOptions = {
  /** true = 全シード。false = バッチ（Cron 向け） */
  full?: boolean;
  batchSize?: number;
  batchIndex?: number;
  delayMs?: number;
};

type RunSpotifyQueueSyncOptions = {
  batchSize?: number;
  delayMs?: number;
  maxAttempts?: number;
};

async function preserveAlbumIds(
  supabase: ReturnType<typeof createAdminClient>,
  albums: DbAlbumRow[],
): Promise<DbAlbumRow[]> {
  const spotifyIds = albums.map((a) => a.spotify_id);
  if (spotifyIds.length === 0) return albums;

  const { data } = await supabase
    .from("albums")
    .select("spotify_id, id")
    .in("spotify_id", spotifyIds);

  const idMap = new Map(
    (data ?? []).map((row) => [row.spotify_id, row.id]),
  );

  return albums.map((album) => {
    const existingId = idMap.get(album.spotify_id);
    if (!existingId) return album;
    return {
      ...album,
      id: existingId.startsWith("sp-alb-") ? album.id : existingId,
    };
  });
}

async function enrichAlbumTracks(
  albums: DbAlbumRow[],
  delayMs: number,
): Promise<DbAlbumRow[]> {
  for (const album of albums) {
    if (!album.spotify_id) continue;

    try {
      const detail = await spotifyFetch<SpotifyAlbumDetail>(
        `/albums/${album.spotify_id}`,
        0,
        { maxRetries: 3, maxRetryWaitSec: 90 },
      );
      album.tracks = mapSpotifyTracksToDb(detail.tracks.items);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (isRateLimitError(message)) {
        break;
      }
    }

    await new Promise((r) => setTimeout(r, delayMs));
  }

  return albums;
}

async function syncArtistToSupabase(
  supabase: ReturnType<typeof createAdminClient>,
  options: { name: string; spotifyId?: string | null },
): Promise<{ artistName: string; albumCount: number }> {
  const result = await fetchSpotifyArtist(options);
  if (!result) {
    throw new Error("検索結果なし");
  }

  const { artist, albums } = result;
  const artistRow = transformArtist(artist, albums, options.name);

  const { error: artistError } = await supabase
    .from("artists")
    .upsert(artistRow, { onConflict: "id" });

  if (artistError) throw new Error(artistError.message);

  let albumRows = albums
    .map((album) => transformAlbum(album, artistRow.id, artist.genres ?? []))
    .filter((row): row is DbAlbumRow => row !== null);

  albumRows = await preserveAlbumIds(supabase, albumRows);

  const trackDelay = Math.max(defaultDelayMs() / 5, 400);
  const enrichedAlbums = await enrichAlbumTracks(albumRows, trackDelay);

  if (albumRows.length > 0) {
    const { error: albumError } = await supabase
      .from("albums")
      .upsert(enrichedAlbums, { onConflict: "id" });

    if (albumError) throw new Error(albumError.message);
  }

  return { artistName: artistRow.name, albumCount: albumRows.length };
}

function isRateLimitError(message: string): boolean {
  return isSpotifyRateLimitError(message);
}

function defaultQueueBatchSize(): number {
  const env = Number(process.env.SPOTIFY_SYNC_BATCH_SIZE);
  return Number.isFinite(env) && env > 0 ? env : 8;
}

function defaultDelayMs(): number {
  const env = Number(process.env.SPOTIFY_SYNC_DELAY_MS);
  return Number.isFinite(env) && env > 0 ? env : 5000;
}

async function processQueueRow(
  supabase: ReturnType<typeof createAdminClient>,
  row: QueueRow,
): Promise<{ ok: true; artistName: string; albumCount: number } | { ok: false; message: string; skip?: boolean }> {
  try {
    const result = await syncArtistToSupabase(supabase, {
      name: row.name,
      spotifyId: row.spotify_id,
    });
    return { ok: true, ...result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("検索結果なし")) {
      return { ok: false, message, skip: true };
    }
    return { ok: false, message };
  }
}

export async function runSpotifyQueueSync(
  options: RunSpotifyQueueSyncOptions = {},
): Promise<SpotifySyncResult> {
  if (!isSpotifyConfigured()) {
    throw new Error(
      "SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET が未設定です。",
    );
  }

  const supabase = createAdminClient();
  const batchSize = options.batchSize ?? defaultQueueBatchSize();
  const delayMs = options.delayMs ?? defaultDelayMs();
  const maxAttempts = options.maxAttempts ?? 5;

  const recovered = await recoverStuckQueueRows(supabase);
  if (recovered > 0) {
    console.log(`↩️ syncing 状態 ${recovered} 件を pending に戻しました`);
  }

  const batch = await fetchQueueBatch(supabase, batchSize, maxAttempts);
  const stats = await getQueueStats(supabase);
  const errors: string[] = [];
  const processed: string[] = [];
  let artistCount = 0;
  let albumCount = 0;
  let attempted = 0;
  let rateLimited = false;

  for (const row of batch) {
    attempted += 1;
    const label = row.spotify_id
      ? `${row.name} (${row.spotify_id})`
      : row.name;

    await markQueueSyncing(supabase, row.id);
    const outcome = await processQueueRow(supabase, row);

    if (outcome.ok) {
      await markQueueDone(supabase, row.id, row.attempts);
      artistCount += 1;
      albumCount += outcome.albumCount;
      processed.push(outcome.artistName);
    } else if (outcome.skip) {
      await markQueueSkipped(supabase, row.id, row.attempts, outcome.message);
      errors.push(`${label}: ${outcome.message}`);
    } else if (isRateLimitError(outcome.message)) {
      await releaseQueueRow(supabase, row.id);
      errors.push(`${label}: ${outcome.message}（後で再試行）`);
      rateLimited = true;
      console.warn("⏸️ Spotify 429 — このバッチを中断します。数分〜数十分後に再実行してください。");
      break;
    } else {
      await markQueueFailed(supabase, row.id, row.attempts, outcome.message);
      errors.push(`${label}: ${outcome.message}`);
    }

    await new Promise((r) => setTimeout(r, delayMs));
  }

  const processedCount = attempted;

  const pending = await countQueuePending(supabase, maxAttempts);

  return {
    mode: "queue",
    seedsTotal: stats.total,
    seedsProcessed: processedCount || batch.length,
    artistCount,
    albumCount,
    errors,
    processed,
    queue: {
      pending,
      done: stats.done + artistCount,
      failed: stats.failed,
    },
    rateLimited,
  };
}

export async function runSpotifySync(
  options: RunSpotifySyncOptions = {},
): Promise<SpotifySyncResult> {
  if (!isSpotifyConfigured()) {
    throw new Error(
      "SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET が未設定です。",
    );
  }

  const supabase = createAdminClient();
  const allSeeds = loadArtistSeeds();
  const full = options.full ?? true;
  const batchSize = options.batchSize ?? 5;
  const batchIndex =
    options.batchIndex ??
    (full ? 0 : batchIndexForToday(allSeeds.length, batchSize));

  const seeds = full
    ? allSeeds
    : pickArtistSeedBatch(allSeeds, batchSize, batchIndex);

  const delayMs = options.delayMs ?? defaultDelayMs();
  const errors: string[] = [];
  const processed: string[] = [];
  let artistCount = 0;
  let albumCount = 0;

  for (const seed of seeds) {
    try {
      const result = await syncArtistToSupabase(supabase, { name: seed });
      artistCount += 1;
      albumCount += result.albumCount;
      processed.push(result.artistName);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${seed}: ${message}`);
      if (isRateLimitError(message)) {
        console.warn("⏸️ Spotify 429 — 同期を中断します。");
        break;
      }
    }

    await new Promise((r) => setTimeout(r, delayMs));
  }

  return {
    mode: full ? "full" : "batch",
    seedsTotal: allSeeds.length,
    seedsProcessed: seeds.length,
    artistCount,
    albumCount,
    errors,
    processed,
  };
}
