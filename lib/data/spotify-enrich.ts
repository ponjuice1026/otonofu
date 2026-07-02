import type { Album, Artist } from "@/lib/types";
import { getSpotifyAlbum, getSpotifyArtistProfile, searchSpotify } from "@/lib/spotify/api";
import { pickImage, spotifyFetchForPage } from "@/lib/spotify/client";
import { isSpotifyConfigured } from "@/lib/spotify/env";
import type { SpotifyAlbum, SpotifyAlbumDetail, SpotifySearchResponse } from "@/lib/spotify/types";

const PAGE_SPOTIFY_TIMEOUT_MS = 5000;

async function withPageTimeout<T>(promise: Promise<T>): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), PAGE_SPOTIFY_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type ArtistSpotifyData = {
  imageUrl: string | null;
  genres: string[];
  followers: number;
  popularity: number;
  spotifyUrl: string | null;
};

export type AlbumSpotifyData = {
  imageUrl: string | null;
  releaseDate: string | null;
  label: string | null;
  totalTracks: number;
  tracks: { id: string; number: number; name: string; duration: string }[];
  spotifyUrl: string | null;
};

function normalizeTitle(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}

function matchSpotifyAlbum(
  album: Album,
  spotifyAlbums: SpotifyAlbum[],
): SpotifyAlbum | undefined {
  const target = normalizeTitle(album.title);
  return spotifyAlbums.find((item) => {
    const name = normalizeTitle(item.name);
    const yearMatch = item.release_date.startsWith(String(album.year));
    return name.includes(target) || target.includes(name) || (yearMatch && name.slice(0, 4) === target.slice(0, 4));
  });
}

async function resolveArtistId(artist: Artist): Promise<string | null> {
  if (artist.spotifyId) return artist.spotifyId;
  if (!isSpotifyConfigured()) return null;

  const result = await searchSpotify(artist.name, "artist", 5);
  const items = result.artists?.items ?? [];
  const exact = items.find(
    (item) => normalizeTitle(item.name) === normalizeTitle(artist.name),
  );
  return exact?.id ?? items[0]?.id ?? null;
}

async function resolveArtistIdForPage(artist: Artist): Promise<string | null> {
  if (artist.spotifyId) return artist.spotifyId;
  if (!isSpotifyConfigured()) return null;

  try {
    const result = await spotifyFetchForPage<SpotifySearchResponse>(
      `/search?q=${encodeURIComponent(artist.name)}&type=artist&limit=5&market=JP`,
    );
    const items = result.artists?.items ?? [];
    const exact = items.find(
      (item) => normalizeTitle(item.name) === normalizeTitle(artist.name),
    );
    return exact?.id ?? items[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function resolveAlbumIdForPage(
  album: Album,
  artistName: string,
): Promise<string | null> {
  if (album.spotifyId) return album.spotifyId;
  if (!isSpotifyConfigured()) return null;

  try {
    const result = await spotifyFetchForPage<SpotifySearchResponse>(
      `/search?q=${encodeURIComponent(`album:${album.title} artist:${artistName}`)}&type=album&limit=5&market=JP`,
    );
    const items = result.albums?.items ?? [];
    return matchSpotifyAlbum(album, items)?.id ?? items[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function resolveAlbumId(
  album: Album,
  artistName: string,
): Promise<string | null> {
  if (album.spotifyId) return album.spotifyId;
  if (!isSpotifyConfigured()) return null;

  const result = await searchSpotify(
    `album:${album.title} artist:${artistName}`,
    "album",
    5,
  );
  const items = result.albums?.items ?? [];
  return matchSpotifyAlbum(album, items)?.id ?? items[0]?.id ?? null;
}

export async function fetchArtistSpotifyData(
  artist: Artist,
): Promise<ArtistSpotifyData | null> {
  if (!isSpotifyConfigured()) return null;

  try {
    const spotifyId = await resolveArtistId(artist);
    if (!spotifyId) return null;

    const data = await getSpotifyArtistProfile(spotifyId);
    return {
      imageUrl: pickImage(data.images),
      genres: data.genres ?? [],
      followers: data.followers?.total ?? 0,
      popularity: data.popularity ?? 0,
      spotifyUrl: data.external_urls?.spotify ?? null,
    };
  } catch {
    return null;
  }
}

export async function fetchArtistSpotifyDataForPage(
  artist: Artist,
): Promise<ArtistSpotifyData | null> {
  if (!isSpotifyConfigured()) return null;

  return withPageTimeout(
    (async () => {
      const spotifyId = await resolveArtistIdForPage(artist);
      if (!spotifyId) return null;

      const data = await spotifyFetchForPage<{
        images: { url: string }[];
        genres?: string[];
        followers?: { total?: number };
        popularity?: number;
        external_urls?: { spotify?: string };
      }>(`/artists/${spotifyId}`);

      return {
        imageUrl: pickImage(data.images),
        genres: data.genres ?? [],
        followers: data.followers?.total ?? 0,
        popularity: data.popularity ?? 0,
        spotifyUrl: data.external_urls?.spotify ?? null,
      };
    })(),
  );
}

export async function fetchAlbumSpotifyData(
  album: Album,
  artistName: string,
): Promise<AlbumSpotifyData | null> {
  if (!isSpotifyConfigured()) return null;

  try {
    const spotifyId = await resolveAlbumId(album, artistName);
    if (!spotifyId) return null;

    const data: SpotifyAlbumDetail = await getSpotifyAlbum(spotifyId);
    return {
      imageUrl: pickImage(data.images),
      releaseDate: data.release_date,
      label: data.label,
      totalTracks: data.total_tracks,
      tracks: data.tracks.items.map((track) => ({
        id: track.id,
        number: track.track_number,
        name: track.name,
        duration: formatMs(track.duration_ms),
      })),
      spotifyUrl: data.external_urls.spotify,
    };
  } catch {
    return null;
  }
}

export async function fetchAlbumSpotifyDataForPage(
  album: Album,
  artistName: string,
): Promise<AlbumSpotifyData | null> {
  if (!isSpotifyConfigured()) return null;

  return withPageTimeout(
    (async () => {
      const spotifyId = await resolveAlbumIdForPage(album, artistName);
      if (!spotifyId) return null;

      const data = await spotifyFetchForPage<SpotifyAlbumDetail>(
        `/albums/${spotifyId}`,
      );

      return {
        imageUrl: pickImage(data.images),
        releaseDate: data.release_date,
        label: data.label,
        totalTracks: data.total_tracks,
        tracks: data.tracks.items.map((track) => ({
          id: track.id,
          number: track.track_number,
          name: track.name,
          duration: formatMs(track.duration_ms),
        })),
        spotifyUrl: data.external_urls.spotify,
      };
    })(),
  );
}

async function fetchAlbumCoverOnly(
  album: Album,
  artistName: string,
  imageSize: "small" | "large" = "large",
  coverCache: Map<string, string>,
): Promise<string | null> {
  if (!isSpotifyConfigured()) return null;

  try {
    const spotifyId = album.spotifyId ?? (await resolveAlbumId(album, artistName));
    if (!spotifyId) return null;

    const cached = coverCache.get(spotifyId);
    if (cached) return cached;

    const data = await getSpotifyAlbum(spotifyId);
    const cover = pickImage(data.images, imageSize);
    if (cover) coverCache.set(spotifyId, cover);
    return cover;
  } catch {
    return null;
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

export async function fetchAlbumCoversForAlbums(
  albums: Album[],
  artistNames: Map<string, string>,
  imageSize: "small" | "large" = "large",
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!isSpotifyConfigured() || albums.length === 0) return map;

  const coverCache = new Map<string, string>();

  const results = await mapWithConcurrency(albums, 5, async (album) => {
    const cover = await fetchAlbumCoverOnly(
      album,
      artistNames.get(album.artistId) ?? "",
      imageSize,
      coverCache,
    );
    return { id: album.id, cover };
  });

  for (const { id, cover } of results) {
    if (cover) map.set(id, cover);
  }

  return map;
}

export async function fetchAlbumCoverMap(
  artist: Artist,
  releases: Album[],
): Promise<Map<string, string>> {
  const artistNames = new Map([[artist.id, artist.name]]);
  return fetchAlbumCoversForAlbums(releases, artistNames, "small");
}

function formatMs(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
