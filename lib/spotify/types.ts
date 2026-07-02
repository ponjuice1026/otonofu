export type SpotifyImage = {
  url: string;
  height: number | null;
  width: number | null;
};

export type SpotifyArtist = {
  id: string;
  name: string;
  images: SpotifyImage[];
  genres: string[];
  popularity: number;
  followers: { total: number };
  external_urls: { spotify: string };
};

export type SpotifyAlbum = {
  id: string;
  name: string;
  images: SpotifyImage[];
  release_date: string;
  total_tracks: number;
  album_type: string;
  artists: { id: string; name: string }[];
  external_urls: { spotify: string };
};

export type SpotifyTrack = {
  id: string;
  name: string;
  track_number: number;
  duration_ms: number;
  external_urls: { spotify: string };
};

export type SpotifySearchResponse = {
  artists?: { items: SpotifyArtist[] };
  albums?: { items: SpotifyAlbum[] };
};

export type SpotifyArtistDetail = SpotifyArtist & {
  albums: SpotifyAlbum[];
};

export type SpotifyAlbumDetail = SpotifyAlbum & {
  tracks: { items: SpotifyTrack[] };
  label: string;
  copyrights: { text: string }[];
};
