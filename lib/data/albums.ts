import { mapAlbum } from "@/lib/data/mappers";
import {
  HOME_RANKING_LIMIT,
  matchesRankingCategory,
  type RankingCategory,
  type RankingPeriod,
  type RankingSort,
  rankingPeriodSince,
} from "@/lib/albums/ranking-filters";
import { getArtistMetaMapForIds } from "@/lib/data/artists";
import { getReleaseTypeLabel } from "@/lib/release-types";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Album } from "@/lib/types";
import type { DbAlbum } from "@/lib/supabase/types";

export const ALBUMS_PAGE_SIZE = 48;

const ALBUM_LIST_COLUMNS =
  "id, title, artist_id, spotify_id, year, genre, release_type, cover_color, cover_url, avg_rating, rating_count";

function mapAlbumRows(data: DbAlbum[]): Album[] {
  return data.map(mapAlbum);
}

export async function getAlbumCount(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("albums")
      .select("id", { count: "exact", head: true });

    if (error || count === null) return 0;
    return count;
  } catch {
    return 0;
  }
}

export async function getAlbumsPage(
  page: number,
  pageSize = ALBUMS_PAGE_SIZE,
): Promise<Album[]> {
  if (!isSupabaseConfigured()) return [];

  const safePage = Math.max(1, page);
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("albums")
      .select(ALBUM_LIST_COLUMNS)
      .order("year", { ascending: false })
      .range(from, to);

    if (error || !data) {
      console.error("[Supabase] getAlbumsPage:", error?.message);
      return [];
    }

    return mapAlbumRows(data as DbAlbum[]);
  } catch (err) {
    console.error("[Supabase] getAlbumsPage:", err);
    return [];
  }
}

export async function getRecentAlbums(limit: number): Promise<Album[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("albums")
      .select(ALBUM_LIST_COLUMNS)
      .order("year", { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return mapAlbumRows(data as DbAlbum[]);
  } catch {
    return [];
  }
}

export async function getTopRatedAlbums(
  limit: number,
  sort: RankingSort = "rating",
): Promise<Album[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createClient();
    let query = supabase
      .from("albums")
      .select(ALBUM_LIST_COLUMNS)
      .gt("rating_count", 0);

    if (sort === "reviews") {
      query = query
        .order("rating_count", { ascending: false })
        .order("avg_rating", { ascending: false });
    } else {
      query = query
        .order("avg_rating", { ascending: false })
        .order("rating_count", { ascending: false });
    }

    const { data, error } = await query.limit(limit);

    if (error || !data) return [];
    return mapAlbumRows(data as DbAlbum[]);
  } catch {
    return [];
  }
}

async function getTopRatedAlbumsByReviewPeriod(
  period: Exclude<RankingPeriod, "all">,
  fetchLimit: number,
  sort: RankingSort = "rating",
): Promise<Album[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createClient();
    const since = rankingPeriodSince(period).toISOString();

    const { data, error } = await supabase
      .from("reviews")
      .select("album_id, rating")
      .not("user_id", "is", null)
      .gte("created_at", since);

    if (error || !data) {
      console.error("[Supabase] getTopRatedAlbumsByReviewPeriod:", error?.message);
      return [];
    }

    const stats = new Map<string, { sum: number; count: number }>();
    for (const row of data) {
      const albumId = row.album_id as string;
      const rating = Number(row.rating);
      const current = stats.get(albumId) ?? { sum: 0, count: 0 };
      current.sum += rating;
      current.count += 1;
      stats.set(albumId, current);
    }

    const ranked = [...stats.entries()]
      .map(([id, stat]) => ({
        id,
        avg: stat.sum / stat.count,
        count: stat.count,
      }))
      .sort((a, b) =>
        sort === "reviews"
          ? b.count - a.count || b.avg - a.avg
          : b.avg - a.avg || b.count - a.count,
      )
      .slice(0, fetchLimit);

    if (ranked.length === 0) return [];

    const albumIds = ranked.map((item) => item.id);
    const { data: albumRows, error: albumError } = await supabase
      .from("albums")
      .select(ALBUM_LIST_COLUMNS)
      .in("id", albumIds);

    if (albumError || !albumRows) return [];

    const albumsById = new Map(
      mapAlbumRows(albumRows as DbAlbum[]).map((album) => [album.id, album]),
    );

    return ranked
      .map(({ id, avg, count }) => {
        const album = albumsById.get(id);
        if (!album) return undefined;
        return {
          ...album,
          avgRating: avg,
          ratingCount: count,
        };
      })
      .filter((album): album is Album => Boolean(album));
  } catch (err) {
    console.error("[Supabase] getTopRatedAlbumsByReviewPeriod:", err);
    return [];
  }
}

export async function getRankedAlbums(options: {
  limit?: number;
  period?: RankingPeriod;
  category?: RankingCategory;
  sort?: RankingSort;
}): Promise<Album[]> {
  const limit = options.limit ?? HOME_RANKING_LIMIT;
  const period = options.period ?? "all";
  const category = options.category ?? "all";
  const sort = options.sort ?? "rating";
  const fetchLimit = category === "all" ? limit : Math.max(limit * 8, 40);

  const candidates =
    period === "all"
      ? await getTopRatedAlbums(fetchLimit, sort)
      : await getTopRatedAlbumsByReviewPeriod(period, fetchLimit, sort);

  if (category === "all") {
    return candidates.slice(0, limit);
  }

  const artistIds = [...new Set(candidates.map((album) => album.artistId))];
  const artistMeta = await getArtistMetaMapForIds(artistIds);

  return candidates
    .filter((album) =>
      matchesRankingCategory(album, artistMeta.get(album.artistId), category),
    )
    .slice(0, limit);
}

function albumScore(album: Album): number {
  return album.avgRating * Math.log2(album.ratingCount + 2);
}

function pickBestAlbums(
  albums: Album[],
  limit: number,
  excludeIds: Set<string>,
): Album[] {
  const picked: Album[] = [];
  const usedArtists = new Set<string>();

  const sorted = [...albums]
    .filter((album) => !excludeIds.has(album.id))
    .sort((a, b) => albumScore(b) - albumScore(a));

  for (const album of sorted) {
    if (picked.length >= limit) break;
    if (usedArtists.has(album.artistId) && sorted.length > limit * 2) continue;
    picked.push(album);
    usedArtists.add(album.artistId);
  }

  if (picked.length < limit) {
    for (const album of sorted) {
      if (picked.length >= limit) break;
      if (picked.some((item) => item.id === album.id)) continue;
      picked.push(album);
    }
  }

  return picked.slice(0, limit);
}

async function getUserAlbumInterests(userId: string): Promise<{
  artistIds: string[];
  reviewedAlbumIds: string[];
}> {
  const supabase = await createClient();
  const artistIds = new Set<string>();
  const reviewedAlbumIds = new Set<string>();

  const [reviewsRes, tracksRes] = await Promise.all([
    supabase
      .from("reviews")
      .select("album_id, artist_id")
      .eq("user_id", userId),
    supabase
      .from("track_ratings")
      .select("album_id")
      .eq("user_id", userId),
  ]);

  for (const row of (reviewsRes.data ?? []) as {
    album_id: string | null;
    artist_id: string | null;
  }[]) {
    if (row.album_id) reviewedAlbumIds.add(row.album_id);
    if (row.artist_id) artistIds.add(row.artist_id);
  }
  for (const row of (tracksRes.data ?? []) as { album_id: string | null }[]) {
    if (row.album_id) reviewedAlbumIds.add(row.album_id);
  }

  if (reviewedAlbumIds.size > 0 && artistIds.size === 0) {
    const { data: albumArtists } = await supabase
      .from("albums")
      .select("artist_id")
      .in("id", [...reviewedAlbumIds]);
    for (const row of (albumArtists ?? []) as { artist_id: string | null }[]) {
      if (row.artist_id) artistIds.add(row.artist_id);
    }
  }

  return {
    artistIds: [...artistIds],
    reviewedAlbumIds: [...reviewedAlbumIds],
  };
}

export async function getRecommendedAlbums(
  userId: string | null,
  limit = 5,
  excludeIds: string[] = [],
): Promise<Album[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createClient();
    const exclude = new Set(excludeIds);
    let candidates: Album[] = [];

    if (userId) {
      const { artistIds, reviewedAlbumIds } = await getUserAlbumInterests(userId);
      for (const id of reviewedAlbumIds) exclude.add(id);

      if (artistIds.length > 0) {
        const { data, error } = await supabase
          .from("albums")
          .select(ALBUM_LIST_COLUMNS)
          .in("artist_id", artistIds)
          .limit(Math.max(limit * 8, 40));

        if (!error && data) {
          candidates = mapAlbumRows(data as DbAlbum[]);
        }
      }
    }

    if (candidates.length < limit) {
      const { data, error } = await supabase
        .from("albums")
        .select(ALBUM_LIST_COLUMNS)
        .gt("rating_count", 0)
        .order("avg_rating", { ascending: false })
        .order("rating_count", { ascending: false })
        .limit(Math.max(limit * 10, 50));

      if (!error && data) {
        const fallback = mapAlbumRows(data as DbAlbum[]);
        const seen = new Set(candidates.map((album) => album.id));
        for (const album of fallback) {
          if (seen.has(album.id)) continue;
          candidates.push(album);
          seen.add(album.id);
        }
      }
    }

    if (candidates.length === 0) {
      return getRecentAlbums(limit);
    }

    return pickBestAlbums(candidates, limit, exclude);
  } catch (err) {
    console.error("[Supabase] getRecommendedAlbums:", err);
    return getRecentAlbums(limit);
  }
}

export async function getTrendingAlbums(limit: number): Promise<Album[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createClient();

    const { data: reviewRows, error: reviewError } = await supabase
      .from("reviews")
      .select("album_id, updated_at")
      .not("user_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(limit * 4);

    if (reviewError) {
      console.error("[Supabase] getTrendingAlbums reviews:", reviewError.message);
    }

    const albumIds: string[] = [];
    const seen = new Set<string>();

    for (const row of reviewRows ?? []) {
      if (seen.has(row.album_id)) continue;
      seen.add(row.album_id);
      albumIds.push(row.album_id);
      if (albumIds.length >= limit) break;
    }

    if (albumIds.length > 0) {
      const { data: albums, error: albumError } = await supabase
        .from("albums")
        .select(ALBUM_LIST_COLUMNS)
        .in("id", albumIds);

      if (!albumError && albums) {
        const byId = new Map(
          mapAlbumRows(albums as DbAlbum[]).map((album) => [album.id, album]),
        );
        const ordered = albumIds
          .map((id) => byId.get(id))
          .filter((album): album is Album => Boolean(album));

        if (ordered.length >= limit) {
          return ordered.slice(0, limit);
        }
      }
    }

    const { data: popularRecent, error: popularError } = await supabase
      .from("albums")
      .select(ALBUM_LIST_COLUMNS)
      .gt("rating_count", 0)
      .order("rating_count", { ascending: false })
      .order("year", { ascending: false })
      .limit(limit);

    if (!popularError && popularRecent && popularRecent.length > 0) {
      return mapAlbumRows(popularRecent as DbAlbum[]);
    }

    return getRecentAlbums(limit);
  } catch (err) {
    console.error("[Supabase] getTrendingAlbums:", err);
    return getRecentAlbums(limit);
  }
}

/** @deprecated 全件取得は遅い。getAlbumsPage / getRecentAlbums を使う */
export async function getAlbums(): Promise<Album[]> {
  return getAlbumsPage(1, 10_000);
}

export async function getAlbumById(id: string): Promise<Album | undefined> {
  if (!isSupabaseConfigured()) {
    return undefined;
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("albums")
      .select(`${ALBUM_LIST_COLUMNS}, tracks`)
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      console.error("[Supabase] getAlbumById:", error?.message);
      return undefined;
    }

    return mapAlbum(data as DbAlbum);
  } catch (err) {
    console.error("[Supabase] getAlbumById:", err);
    return undefined;
  }
}

export type AlbumCoverInfo = {
  coverUrl?: string;
  coverColor: string;
  spotifyId?: string;
};

export async function getAlbumCoverMapForIds(
  albumIds: string[],
): Promise<Map<string, AlbumCoverInfo>> {
  const map = new Map<string, AlbumCoverInfo>();
  if (!isSupabaseConfigured() || albumIds.length === 0) return map;

  const unique = [...new Set(albumIds)];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("albums")
      .select("id, cover_url, cover_color, spotify_id")
      .in("id", unique);

    if (error || !data) return map;

    for (const row of data) {
      map.set(row.id, {
        coverUrl: row.cover_url ?? undefined,
        coverColor: row.cover_color,
        spotifyId: row.spotify_id ?? undefined,
      });
    }
  } catch {
    return map;
  }

  return map;
}

export async function getAlbumsByArtistId(artistId: string): Promise<Album[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("albums")
      .select(ALBUM_LIST_COLUMNS)
      .eq("artist_id", artistId)
      .order("year", { ascending: false });

    if (error || !data) {
      console.error("[Supabase] getAlbumsByArtistId:", error?.message);
      return [];
    }

    return mapAlbumRows(data as DbAlbum[]);
  } catch (err) {
    console.error("[Supabase] getAlbumsByArtistId:", err);
    return [];
  }
}

export { getReleaseTypeLabel };
