import { mapAlbum } from "@/lib/data/mappers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { GENRES, getGenreBySlug, matchGenreSlugs, type Genre } from "@/lib/genres";
import type { Album } from "@/lib/types";
import type { DbAlbum } from "@/lib/supabase/types";

/**
 * ジャンル別ブラウジングのデータ層。
 *
 * 現状ジャンルはDBで正規化されていないため、`albums.genre`(単一文字列)と
 * `artists.genres`(Spotify由来の文字列配列)を lib/genres.ts の aliases でマッチングする。
 * getRankedAlbums(lib/data/albums.ts)の絞り込み方針に倣い、候補をまとめて取得してから
 * アプリ側でフィルタリングする。
 *
 * TODO(将来): genres / album_genres テーブルへ移行すれば、ここは単純な JOIN クエリになる。
 */

const ALBUM_LIST_COLUMNS =
  "id, title, artist_id, spotify_id, year, genre, release_type, cover_color, cover_url, avg_rating, rating_count";

export type GenreSort = "rating" | "recent" | "year";

export const GENRE_SORT_OPTIONS = [
  { value: "rating" as const, label: "評価順" },
  { value: "recent" as const, label: "新着順" },
  { value: "year" as const, label: "年代順" },
];

export function parseGenreSort(value: string | undefined): GenreSort {
  if (value === "recent" || value === "year") return value;
  return "rating";
}

export function genreSortLabel(sort: GenreSort): string {
  return GENRE_SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "";
}

/** アーティストID → そのアーティストのジャンル配列 */
async function getArtistGenresMap(
  artistIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!isSupabaseConfigured() || artistIds.length === 0) return map;

  const unique = [...new Set(artistIds)];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("artists")
      .select("id, genres")
      .in("id", unique);

    if (error || !data) return map;
    for (const row of data) {
      map.set(row.id, (row.genres ?? []) as string[]);
    }
  } catch {
    return map;
  }
  return map;
}

/**
 * 全アルバムを候補として取得し、album.genre と artist.genres を
 * 指定 slug に対して aliases マッチングして絞り込む。
 */
async function getGenreMatchedAlbums(slug: string): Promise<Album[]> {
  if (!isSupabaseConfigured()) return [];
  if (!getGenreBySlug(slug)) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("albums")
      .select(ALBUM_LIST_COLUMNS)
      .order("avg_rating", { ascending: false })
      .limit(10_000);

    if (error || !data) {
      console.error("[Supabase] getGenreMatchedAlbums:", error?.message);
      return [];
    }

    const albums = (data as DbAlbum[]).map(mapAlbum);
    const artistGenres = await getArtistGenresMap(
      albums.map((a) => a.artistId),
    );

    return albums.filter((album) => {
      const slugs = matchGenreSlugs([
        album.genre,
        ...(artistGenres.get(album.artistId) ?? []),
      ]);
      return slugs.has(slug);
    });
  } catch (err) {
    console.error("[Supabase] getGenreMatchedAlbums:", err);
    return [];
  }
}

function sortAlbums(albums: Album[], sort: GenreSort): Album[] {
  const copy = [...albums];
  switch (sort) {
    case "recent":
      // 新着順: 収録年の新しい順(created_at列が一覧カラムに無いため year で代替)
      return copy.sort((a, b) => b.year - a.year);
    case "year":
      // 年代順: 古い順
      return copy.sort((a, b) => a.year - b.year);
    case "rating":
    default:
      return copy.sort(
        (a, b) => b.avgRating - a.avgRating || b.ratingCount - a.ratingCount,
      );
  }
}

export type GenreAlbumsResult = {
  genre: Genre;
  albums: Album[];
  total: number;
};

export async function getAlbumsForGenre(
  slug: string,
  sort: GenreSort,
): Promise<GenreAlbumsResult | null> {
  const genre = getGenreBySlug(slug);
  if (!genre) return null;

  const matched = await getGenreMatchedAlbums(slug);
  return {
    genre,
    albums: sortAlbums(matched, sort),
    total: matched.length,
  };
}

export type GenreSummary = {
  genre: Genre;
  count: number;
  /** 代表アルバム(評価上位1件)。カバー表示用 */
  cover?: {
    id: string;
    coverUrl?: string;
    coverColor: string;
    spotifyId?: string;
  };
};

/**
 * ジャンル一覧ページ用。全アルバムを1回だけ取得し、各ジャンルの
 * アルバム数と代表カバーを集計する(ジャンルごとに個別クエリしない)。
 */
export async function getGenreSummaries(): Promise<GenreSummary[]> {
  if (!isSupabaseConfigured()) {
    return GENRES.map((genre) => ({ genre, count: 0 }));
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("albums")
      .select(ALBUM_LIST_COLUMNS)
      .order("avg_rating", { ascending: false })
      .limit(10_000);

    if (error || !data) {
      return GENRES.map((genre) => ({ genre, count: 0 }));
    }

    const albums = (data as DbAlbum[]).map(mapAlbum);
    const artistGenres = await getArtistGenresMap(
      albums.map((a) => a.artistId),
    );

    const counts = new Map<string, number>();
    const covers = new Map<string, GenreSummary["cover"]>();

    // albums は avg_rating 降順。先に来たものを代表カバーとして採用。
    for (const album of albums) {
      const slugs = matchGenreSlugs([
        album.genre,
        ...(artistGenres.get(album.artistId) ?? []),
      ]);
      for (const slug of slugs) {
        counts.set(slug, (counts.get(slug) ?? 0) + 1);
        if (!covers.has(slug)) {
          covers.set(slug, {
            id: album.id,
            coverUrl: album.coverUrl,
            coverColor: album.coverColor,
            spotifyId: album.spotifyId,
          });
        }
      }
    }

    return GENRES.map((genre) => ({
      genre,
      count: counts.get(genre.slug) ?? 0,
      cover: covers.get(genre.slug),
    }));
  } catch (err) {
    console.error("[Supabase] getGenreSummaries:", err);
    return GENRES.map((genre) => ({ genre, count: 0 }));
  }
}
