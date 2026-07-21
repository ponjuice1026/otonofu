import type { Album, Artist, Review } from "@/lib/types";
import type { DbAlbum, DbArtist, DbReview } from "@/lib/supabase/types";
import { parseAlbumTracks } from "@/lib/spotify/tracks";

export function mapArtist(row: DbArtist): Artist {
  return {
    id: row.id,
    name: row.name,
    nameEn: row.name_en ?? undefined,
    spotifyId: row.spotify_id ?? undefined,
    origin: row.origin,
    activeFrom: row.active_from,
    activeTo: row.active_to ?? undefined,
    genres: row.genres,
    bio: row.bio,
    career: row.career ?? [],
    imageUrl: row.image_url ?? undefined,
  };
}

export function mapAlbum(row: DbAlbum): Album {
  return {
    id: row.id,
    title: row.title,
    artistId: row.artist_id,
    spotifyId: row.spotify_id ?? undefined,
    year: row.year,
    genre: row.genre,
    type: row.release_type,
    coverColor: row.cover_color,
    coverUrl: row.cover_url ?? undefined,
    tracks: (() => {
      const parsed = parseAlbumTracks(row.tracks);
      return parsed.length > 0 ? parsed : undefined;
    })(),
    avgRating: Number(row.avg_rating),
    ratingCount: row.rating_count,
  };
}

function mapCriteriaRatings(row: DbReview): Review["criteriaRatings"] {
  const lyrics = row.rating_lyrics;
  const musicality = row.rating_musicality;
  const atmosphere = row.rating_atmosphere;
  const innovation = row.rating_innovation;

  if (
    lyrics == null ||
    musicality == null ||
    atmosphere == null ||
    innovation == null
  ) {
    return undefined;
  }

  return {
    lyrics: Number(lyrics),
    musicality: Number(musicality),
    atmosphere: Number(atmosphere),
    innovation: Number(innovation),
  };
}

export function mapReview(row: DbReview): Review {
  return {
    id: row.id,
    albumId: row.album_id,
    albumTitle: row.album_title,
    artistId: row.artist_id,
    userId: row.user_id ?? undefined,
    username: row.username,
    rating: Number(row.rating),
    criteriaRatings: mapCriteriaRatings(row),
    body: row.body,
    createdAt: row.created_at,
    sessionOptOut: row.session_opt_out ?? false,
  };
}
