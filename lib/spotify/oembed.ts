const OEMBED_BASE = "https://open.spotify.com/oembed";

export async function fetchSpotifyOEmbedThumbnail(
  spotifyUrl: string,
): Promise<string | null> {
  try {
    const response = await fetch(
      `${OEMBED_BASE}?url=${encodeURIComponent(spotifyUrl)}`,
    );

    if (!response.ok) return null;

    const data = (await response.json()) as { thumbnail_url?: string };
    return data.thumbnail_url ?? null;
  } catch {
    return null;
  }
}

export function spotifyAlbumUrl(spotifyId: string): string {
  return `https://open.spotify.com/album/${spotifyId}`;
}

export function spotifyArtistUrl(spotifyId: string): string {
  return `https://open.spotify.com/artist/${spotifyId}`;
}
