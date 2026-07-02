import type { SpotifyTrack } from "@/lib/spotify/types";
import type { AlbumTrack } from "@/lib/types";

export type DbAlbumTrack = AlbumTrack;

export function formatTrackDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function mapSpotifyTracksToDb(items: SpotifyTrack[]): DbAlbumTrack[] {
  return items.map((track) => ({
    id: track.id,
    number: track.track_number,
    name: track.name,
    duration: formatTrackDuration(track.duration_ms),
  }));
}

export function parseAlbumTracks(value: unknown): AlbumTrack[] {
  if (!Array.isArray(value)) return [];

  const tracks: AlbumTrack[] = [];
  for (const item of value) {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as AlbumTrack).id === "string" &&
      typeof (item as AlbumTrack).number === "number" &&
      typeof (item as AlbumTrack).name === "string"
    ) {
      tracks.push({
        id: (item as AlbumTrack).id,
        number: (item as AlbumTrack).number,
        name: (item as AlbumTrack).name,
        duration:
          typeof (item as AlbumTrack).duration === "string"
            ? (item as AlbumTrack).duration
            : "0:00",
      });
    }
  }

  return tracks.sort((a, b) => a.number - b.number);
}
