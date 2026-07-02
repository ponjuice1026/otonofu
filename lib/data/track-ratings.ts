import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { TrackRating } from "@/lib/types";
import type { DbTrackRating } from "@/lib/supabase/types";

function mapTrackRating(row: DbTrackRating): TrackRating {
  return {
    id: row.id,
    albumId: row.album_id,
    spotifyTrackId: row.spotify_track_id,
    trackNumber: row.track_number,
    trackName: row.track_name,
    rating: Number(row.rating),
    userId: row.user_id,
  };
}

export async function getUserTrackRatingsForAlbum(
  userId: string,
  albumId: string,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!isSupabaseConfigured()) return map;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("track_ratings")
      .select("spotify_track_id, rating")
      .eq("user_id", userId)
      .eq("album_id", albumId);

    if (error || !data) return map;

    for (const row of data) {
      map.set(row.spotify_track_id, Number(row.rating));
    }
  } catch {
    return map;
  }

  return map;
}

export async function getTrackRatingAveragesForAlbum(
  albumId: string,
): Promise<Map<string, { avg: number; count: number }>> {
  const map = new Map<string, { avg: number; count: number }>();
  if (!isSupabaseConfigured()) return map;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("track_ratings")
      .select("spotify_track_id, rating")
      .eq("album_id", albumId);

    if (error || !data) return map;

    const buckets = new Map<string, number[]>();
    for (const row of data) {
      const list = buckets.get(row.spotify_track_id) ?? [];
      list.push(Number(row.rating));
      buckets.set(row.spotify_track_id, list);
    }

    for (const [trackId, ratings] of buckets) {
      const sum = ratings.reduce((a, b) => a + b, 0);
      map.set(trackId, {
        avg: Math.round((sum / ratings.length) * 10) / 10,
        count: ratings.length,
      });
    }
  } catch {
    return map;
  }

  return map;
}

export type { TrackRating };
