import type { Album, Artist } from "@/lib/types";

export function albumCoverSrc(album: Album): string | undefined {
  if (album.coverUrl) return album.coverUrl;
  if (album.spotifyId) return `/api/covers/album/${album.spotifyId}`;
  return undefined;
}

export function artistImageSrc(artist: Artist): string | undefined {
  if (artist.imageUrl) return artist.imageUrl;
  if (artist.spotifyId) return `/api/covers/artist/${artist.spotifyId}`;
  return undefined;
}
