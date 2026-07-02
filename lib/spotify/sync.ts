import type { CareerEvent } from "@/lib/types";
import { getSpotifyArtist, searchSpotify } from "@/lib/spotify/api";
import { pickImage } from "@/lib/spotify/client";
import type { DbAlbumTrack } from "@/lib/spotify/tracks";
import type { SpotifyAlbum, SpotifyArtist } from "@/lib/spotify/types";

/** 既存オトノフ ID との対応（レビュー等を維持） */
export const SPOTIFY_ARTIST_ID_MAP: Record<string, string> = {
  "1LQQtqc1vQ1neUgZrjYlEU": "yumi-arai",
  "1g8HCTiMwBtFtpRR9JXAZR": "fishmans",
  "2vJObElaIZWYDLpiXiJMo9": "cornelius",
  "2XjqKvB2Xz9IdyjWPIHaXi": "ringo-shiina",
  "0cFJWqLH2LZPzuTGS1ljV0": "ohtaki-eiichi",
};

/** 既存オトノフのアルバム ID 維持 */
export const SPOTIFY_ALBUM_ID_MAP: Record<string, string> = {
  "4EX1fAypgQC9wDjGI5QzbZ": "2",
  "0jWKPSADCOdw4Ez5KmJ7zE": "8",
  "6orQve3m8UVGK3H91ZLm7a": "3",
  "4XH9KiaS5k5oZEpPRTZqNp": "9",
  "0QWI6wd3QBiQscVpBu6kUE": "10",
};

/** 検索名 → Spotify ID（既知のアーティストは検索 API を省略） */
export const SPOTIFY_SEED_IDS: Record<string, string> = {
  Fishmans: "1g8HCTiMwBtFtpRR9JXAZR",
  Cornelius: "2vJObElaIZWYDLpiXiJMo9",
  椎名林檎: "2XjqKvB2Xz9IdyjWPIHaXi",
  松任谷由実: "1LQQtqc1vQ1neUgZrjYlEU",
  大瀧詠一: "0cFJWqLH2LZPzuTGS1ljV0",
  "King Gnu": "6wxfx1yhyqjCPYwwxJktR2",
  米津玄師: "3DkjnIlZW4U13Kt5M0lD55",
  RADWIMPS: "1EowJ1WwkMzkCkRomFhui7",
  YOASOBI: "64tJ2EAv1R6UaZqc4iOCyj",
  藤井風: "6bDWAcdtVR3WHz2xtiIPUi",
  あいみょん: "4fdamIsxmL3l9CjRvAlEXo",
  "Mrs. GREEN APPLE": "4QvgGvpgzgyUOo8Yp8LDm9",
  サカナクション: "0hCWVMGGQnRVfDgmhwLIxq",
  東京事変: "6KQWWzFLPQbqomJrieHAW5",
  "Official髭男dism": "5Vo1hnCRmCM6M4thZCInCj",
  "back number": "6rs1KAoQnFalSqSU4LTh8g",
  クリープハイプ: "6POfB0fHdzXFLWL3RHxLv8",
  竹内まりや: "3WwGRA2o4Ux1RRMYaYDh7N",
  山下达郎: "41hQ0PoEyj9xEBhwt73aWC",
  宇多田ヒカル: "7lbSsjYACZHn1MSDXPxNF2",
  "BUMP OF CHICKEN": "0hSFeqPehe7FtCNWuQ6Bsy",
};

/** フォールバック用（通常は data/spotify-seeds.txt を使用） */
export const SPOTIFY_ARTIST_SEEDS = [
  "Fishmans",
  "Cornelius",
  "椎名林檎",
  "松任谷由実",
  "大瀧詠一",
  "King Gnu",
  "米津玄師",
  "RADWIMPS",
  "YOASOBI",
  "藤井風",
  "あいみょん",
  "Mrs. GREEN APPLE",
  "サカナクション",
  "東京事変",
  "Official髭男dism",
  "back number",
  "クリープハイプ",
  "竹内まりや",
  "山下达郎",
  "宇多田ヒカル",
  "BUMP OF CHICKEN",
  "スピッツ",
  "Mr.Children",
  "ONE OK ROCK",
  "星野源",
  "Ado",
  "Vaundy",
];

export type DbArtistRow = {
  id: string;
  name: string;
  name_en: string | null;
  origin: string;
  active_from: number;
  active_to: number | null;
  genres: string[];
  bio: string;
  career: CareerEvent[];
  spotify_id: string;
  image_url: string | null;
};

export type DbAlbumRow = {
  id: string;
  title: string;
  artist_id: string;
  year: number;
  genre: string;
  release_type: "album" | "ep" | "compilation";
  cover_color: string;
  cover_url: string | null;
  tracks: DbAlbumTrack[];
  avg_rating: number;
  rating_count: number;
  spotify_id: string;
};

function colorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 45%, 35%)`;
}

function parseYear(releaseDate: string): number {
  const year = Number(releaseDate.slice(0, 4));
  return Number.isFinite(year) ? year : new Date().getFullYear();
}

function mapReleaseType(
  albumType: string,
): "album" | "ep" | "compilation" | null {
  if (albumType === "album") return "album";
  if (albumType === "single") return "ep";
  if (albumType === "compilation") return "compilation";
  return null;
}

function buildCareer(albums: SpotifyAlbum[]): CareerEvent[] {
  return [...albums]
    .filter((a) => mapReleaseType(a.album_type))
    .sort((a, b) => parseYear(a.release_date) - parseYear(b.release_date))
    .slice(0, 12)
    .map((album) => ({
      year: parseYear(album.release_date),
      label: `『${album.name}』`,
      description:
        album.album_type === "album"
          ? "アルバム"
          : album.album_type === "single"
            ? "シングル / EP"
            : "コンピレーション",
    }));
}

const JAPANESE_RE = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF66-\uFF9F]/;

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}

function hasJapanese(text: string): boolean {
  return JAPANESE_RE.test(text);
}

/** シード名（日本語）を name、Spotify 名を name_en に振り分ける */
export function resolveArtistNames(
  seedName: string,
  spotifyName: string,
): { name: string; name_en: string | null } {
  if (hasJapanese(seedName)) {
    const name = seedName;
    const name_en =
      normalizeName(spotifyName) !== normalizeName(seedName)
        ? spotifyName
        : null;
    return { name, name_en };
  }

  const name = spotifyName;
  const name_en =
    normalizeName(seedName) !== normalizeName(spotifyName) ? seedName : null;
  return { name, name_en };
}

function buildBio(artist: SpotifyArtist, displayName: string): string {
  const genreList = artist.genres ?? [];
  const genres =
    genreList.length > 0
      ? genreList.slice(0, 4).join("、")
      : "ジャンル情報なし";
  const followers = artist.followers?.total ?? 0;
  return `${displayName}。Spotify より同期。ジャンル: ${genres}。フォロワー ${followers.toLocaleString("ja-JP")}。`;
}

export function resolveArtistId(spotifyId: string): string {
  return SPOTIFY_ARTIST_ID_MAP[spotifyId] ?? `sp-${spotifyId}`;
}

export function resolveAlbumId(spotifyAlbumId: string): string {
  return SPOTIFY_ALBUM_ID_MAP[spotifyAlbumId] ?? `sp-alb-${spotifyAlbumId}`;
}

export function transformArtist(
  artist: SpotifyArtist,
  albums: SpotifyAlbum[],
  seedName?: string,
): DbArtistRow {
  const studioAlbums = albums.filter((a) => mapReleaseType(a.album_type));
  const years = studioAlbums.map((a) => parseYear(a.release_date));
  const activeFrom = years.length > 0 ? Math.min(...years) : new Date().getFullYear();
  const { name, name_en } = resolveArtistNames(seedName ?? artist.name, artist.name);

  return {
    id: resolveArtistId(artist.id),
    name,
    name_en,
    origin: "日本",
    active_from: activeFrom,
    active_to: null,
    genres: (artist.genres ?? []).slice(0, 5),
    bio: buildBio(artist, name),
    career: buildCareer(albums),
    spotify_id: artist.id,
    image_url: pickImage(artist.images),
  };
}

export function transformAlbum(
  album: SpotifyAlbum,
  artistId: string,
  artistGenres: string[],
): DbAlbumRow | null {
  const releaseType = mapReleaseType(album.album_type);
  if (!releaseType) return null;

  return {
    id: resolveAlbumId(album.id),
    title: album.name,
    artist_id: artistId,
    year: parseYear(album.release_date),
    genre: artistGenres[0] ?? "Pop",
    release_type: releaseType,
    cover_color: colorFromId(album.id),
    cover_url: pickImage(album.images, "large"),
    tracks: [],
    avg_rating: 0,
    rating_count: 0,
    spotify_id: album.id,
  };
}

export async function fetchSpotifyArtistById(
  spotifyId: string,
): Promise<{ artist: SpotifyArtist; albums: SpotifyAlbum[] }> {
  const detail = await getSpotifyArtist(spotifyId);
  return { artist: detail, albums: detail.albums };
}

export async function fetchSpotifyArtist(
  options: { name: string; spotifyId?: string | null },
): Promise<{ artist: SpotifyArtist; albums: SpotifyAlbum[] } | null> {
  if (options.spotifyId) {
    return fetchSpotifyArtistById(options.spotifyId);
  }
  return fetchSpotifyArtistByName(options.name);
}

export async function fetchSpotifyArtistByName(
  name: string,
): Promise<{ artist: SpotifyArtist; albums: SpotifyAlbum[] } | null> {
  const knownId = SPOTIFY_SEED_IDS[name];
  if (knownId) {
    const detail = await getSpotifyArtist(knownId);
    return { artist: detail, albums: detail.albums };
  }

  const result = await searchSpotify(name, "artist", 5);
  const items = result.artists?.items ?? [];
  if (items.length === 0) return null;

  const normalized = name.toLowerCase().replace(/\s+/g, "");
  const match =
    items.find((item) => item.name.toLowerCase().replace(/\s+/g, "") === normalized) ??
    items[0];

  const detail = await getSpotifyArtist(match.id);
  return { artist: detail, albums: detail.albums };
}
