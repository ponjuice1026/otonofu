import { mapArtist } from "@/lib/data/mappers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Artist } from "@/lib/types";
import type { DbArtist } from "@/lib/supabase/types";

const ARTIST_LIST_COLUMNS =
  "id, name, name_en, spotify_id, image_url, origin, active_from, active_to, genres, bio";

export async function getArtists(): Promise<Artist[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("artists")
      .select(ARTIST_LIST_COLUMNS)
      .order("name");

    if (error || !data) {
      console.error("[Supabase] getArtists:", error?.message);
      return [];
    }

    return (data as DbArtist[]).map(mapArtist);
  } catch (err) {
    console.error("[Supabase] getArtists:", err);
    return [];
  }
}

export async function getArtistById(id: string): Promise<Artist | undefined> {
  if (!isSupabaseConfigured()) {
    return undefined;
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("artists")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      console.error("[Supabase] getArtistById:", error?.message);
      return undefined;
    }

    return mapArtist(data as DbArtist);
  } catch (err) {
    console.error("[Supabase] getArtistById:", err);
    return undefined;
  }
}

export async function getArtistName(artistId: string): Promise<string> {
  if (!isSupabaseConfigured()) {
    return "Unknown Artist";
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("artists")
      .select("name")
      .eq("id", artistId)
      .maybeSingle();

    if (!error && data?.name) {
      return data.name;
    }
  } catch (err) {
    console.error("[Supabase] getArtistName:", err);
  }

  return "Unknown Artist";
}

export async function getArtistNameMapForIds(
  artistIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!isSupabaseConfigured() || artistIds.length === 0) return map;

  const unique = [...new Set(artistIds)];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("artists")
      .select("id, name")
      .in("id", unique);

    if (error || !data) return map;

    for (const row of data) {
      map.set(row.id, row.name);
    }
  } catch {
    return map;
  }

  return map;
}

export async function getArtistMetaMapForIds(
  artistIds: string[],
): Promise<Map<string, { origin: string; genres: string[] }>> {
  const map = new Map<string, { origin: string; genres: string[] }>();
  if (!isSupabaseConfigured() || artistIds.length === 0) return map;

  const unique = [...new Set(artistIds)];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("artists")
      .select("id, origin, genres")
      .in("id", unique);

    if (error || !data) return map;

    for (const row of data) {
      map.set(row.id, {
        origin: row.origin ?? "",
        genres: row.genres ?? [],
      });
    }
  } catch {
    return map;
  }

  return map;
}

export async function getAlbumCountsByArtistId(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!isSupabaseConfigured()) return counts;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("albums").select("artist_id");

    if (error || !data) return counts;

    for (const row of data) {
      counts.set(row.artist_id, (counts.get(row.artist_id) ?? 0) + 1);
    }
  } catch {
    return counts;
  }

  return counts;
}

export function buildArtistNameMap(artists: Artist[]): Map<string, string> {
  return new Map(artists.map((artist) => [artist.id, artist.name]));
}

export { getAlbumsByArtistId } from "@/lib/data/albums";
