import { isSpotifyRateLimitError, spotifyFetch } from "@/lib/spotify/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapSpotifyTracksToDb } from "@/lib/spotify/tracks";
import type { SpotifyAlbumDetail } from "@/lib/spotify/types";

export type BackfillTracksResult = {
  success: number;
  failed: number;
  rateLimited: boolean;
  processed: string[];
};

type AlbumTarget = {
  id: string;
  title: string;
  spotify_id: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function countAlbumsMissingTracks(): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("albums")
    .select("id, tracks")
    .not("spotify_id", "is", null);

  if (error || !data) return 0;

  return data.filter((album) => {
    const tracks = album.tracks;
    return !Array.isArray(tracks) || tracks.length === 0;
  }).length;
}

export async function backfillAlbumTracksBatch(
  limit: number,
  delayMs: number,
): Promise<BackfillTracksResult> {
  const supabase = createAdminClient();
  const { data: albums, error } = await supabase
    .from("albums")
    .select("id, title, spotify_id, tracks")
    .not("spotify_id", "is", null)
    .order("year", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const targets = (albums ?? [])
    .filter((album) => {
      const tracks = album.tracks;
      return !Array.isArray(tracks) || tracks.length === 0;
    })
    .slice(0, limit) as AlbumTarget[];

  let success = 0;
  let failed = 0;
  let rateLimited = false;
  const processed: string[] = [];

  for (const album of targets) {
    try {
      const detail = await spotifyFetch<SpotifyAlbumDetail>(
        `/albums/${album.spotify_id}`,
        0,
        { maxRetries: 3, maxRetryWaitSec: 90 },
      );
      const tracks = mapSpotifyTracksToDb(detail.tracks.items);

      const { error: updateError } = await supabase
        .from("albums")
        .update({ tracks })
        .eq("id", album.id);

      if (updateError) {
        failed += 1;
        continue;
      }

      success += 1;
      processed.push(`${album.title} (${tracks.length} 曲)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failed += 1;
      if (isSpotifyRateLimitError(message)) {
        rateLimited = true;
        break;
      }
    }

    await sleep(delayMs);
  }

  return { success, failed, rateLimited, processed };
}
