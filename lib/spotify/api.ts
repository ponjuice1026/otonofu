import { spotifyFetch } from "@/lib/spotify/client";
import type {
  SpotifyAlbum,
  SpotifyAlbumDetail,
  SpotifyArtistDetail,
  SpotifySearchResponse,
} from "@/lib/spotify/types";

export async function searchSpotify(
  query: string,
  type: "artist" | "album" | "both" = "both",
  limit = 20,
  offset = 0,
) {
  const types =
    type === "both" ? "artist,album" : type === "artist" ? "artist" : "album";
  // Spotify API は 2026 年現在 /search の limit を最大 10 までに制限している
  const safeLimit = Math.min(limit, 10);

  return spotifyFetch<SpotifySearchResponse>(
    `/search?q=${encodeURIComponent(query)}&type=${types}&limit=${safeLimit}&offset=${offset}&market=JP`,
  );
}

export async function getSpotifyArtistProfile(id: string) {
  return spotifyFetch<Omit<SpotifyArtistDetail, "albums">>(`/artists/${id}`);
}

async function fetchArtistAlbums(
  artistId: string,
  _artistName: string,
): Promise<SpotifyAlbum[]> {
  // Spotify API は 2026 年現在 /artists/{id}/albums の limit を最大 10 までに制限している
  const pageSize = 10;
  const items: SpotifyAlbum[] = [];
  let offset = 0;
  const maxPages = 10;

  for (let page = 0; page < maxPages; page += 1) {
    const response = await spotifyFetch<{
      items: SpotifyAlbum[];
      next: string | null;
    }>(
      `/artists/${artistId}/albums?include_groups=album,single&market=JP&limit=${pageSize}&offset=${offset}`,
    );

    items.push(...response.items);

    if (!response.next || response.items.length < pageSize) break;
    offset += pageSize;
  }

  return items;
}

export async function getSpotifyArtist(id: string) {
  const artist = await getSpotifyArtistProfile(id);
  const albums = await fetchArtistAlbums(id, artist.name);

  return { ...artist, albums } satisfies SpotifyArtistDetail;
}

export async function getSpotifyAlbum(id: string) {
  return spotifyFetch<SpotifyAlbumDetail>(`/albums/${id}`);
}
