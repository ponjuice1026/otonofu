import { mapReview } from "@/lib/data/mappers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  matchesSearchQuery,
  searchMatchScore,
} from "@/lib/search/normalize";
import { searchResultSnippet } from "@/lib/search/snippet";
import {
  buildIlikeOrFilter,
  escapeLikePattern,
} from "@/lib/search/postgrest-filter";
import type { DbReview } from "@/lib/supabase/types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** RPC search_artists / search_albums の戻り行 */
type DbArtistSearchRpcRow = DbArtistSearchRow & { score: number | null };
type DbAlbumSearchRpcRow = DbAlbumSearchRow & { score: number | null };

export type SearchArtistHit = {
  type: "artist";
  id: string;
  name: string;
  nameEn?: string;
  imageUrl?: string;
  spotifyId?: string;
};

export type SearchAlbumHit = {
  type: "album";
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  artistNameEn?: string;
  year: number;
  coverUrl?: string;
  spotifyId?: string;
};

export type SearchThreadHit = {
  type: "thread";
  id: string;
  title: string;
  snippet: string;
  authorName: string;
  updatedAt: string;
};

export type SearchReviewHit = {
  type: "review";
  id: string;
  albumId: string;
  albumTitle: string;
  artistId: string;
  username: string;
  snippet: string;
  rating: number;
  createdAt: string;
};

export type SearchPostHit = {
  type: "post";
  id: string;
  threadId: string;
  threadTitle: string;
  anonymousName: string;
  snippet: string;
  createdAt: string;
};

export type SiteSearchResult = {
  artists: SearchArtistHit[];
  albums: SearchAlbumHit[];
  threads: SearchThreadHit[];
  reviews: SearchReviewHit[];
  posts: SearchPostHit[];
};

/** @deprecated Use SiteSearchResult */
export type SearchCatalogResult = SiteSearchResult;

const ARTIST_SEARCH_COLUMNS = "id, name, name_en, spotify_id, image_url";
const ALBUM_SEARCH_COLUMNS =
  "id, title, artist_id, year, cover_url, spotify_id";
const THREAD_SEARCH_COLUMNS = "id, title, body, author_id, updated_at, status";
const POST_SEARCH_COLUMNS =
  "id, thread_id, body, anonymous_name, created_at";

type DbArtistSearchRow = {
  id: string;
  name: string;
  name_en: string | null;
  spotify_id: string | null;
  image_url: string | null;
};

type DbAlbumSearchRow = {
  id: string;
  title: string;
  artist_id: string;
  year: number;
  cover_url: string | null;
  spotify_id: string | null;
};

type DbThreadSearchRow = {
  id: string;
  title: string;
  body: string;
  author_id: string;
  updated_at: string;
  status: string;
};

type DbPostSearchRow = {
  id: string;
  thread_id: string;
  body: string;
  anonymous_name: string;
  created_at: string;
};

async function loadAuthorNames(authorIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (authorIds.length === 0) return map;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .in("id", authorIds);

  for (const row of data ?? []) {
    const name =
      row.display_name?.trim() || row.username?.trim() || "ユーザー";
    map.set(row.id, name);
  }

  return map;
}

async function searchThreads(
  trimmed: string,
  safeLimit: number,
): Promise<SearchThreadHit[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("discussion_threads")
    .select(THREAD_SEARCH_COLUMNS)
    .eq("status", "published")
    .or(buildIlikeOrFilter(["title", "body"], trimmed))
    .order("updated_at", { ascending: false })
    .limit(safeLimit * 3);

  if (error || !data) {
    console.error("[Supabase] searchThreads:", error?.message);
    return [];
  }

  const rows = (data as DbThreadSearchRow[]).filter((row) =>
    matchesSearchQuery(trimmed, row.title, row.body),
  );

  const authorNames = await loadAuthorNames([
    ...new Set(rows.map((row) => row.author_id)),
  ]);

  return rows
    .map((row): SearchThreadHit => {
      const snippetSource = matchesSearchQuery(trimmed, row.title)
        ? row.body || row.title
        : row.body || row.title;
      return {
        type: "thread",
        id: row.id,
        title: row.title,
        snippet: searchResultSnippet(snippetSource),
        authorName: authorNames.get(row.author_id) ?? "ユーザー",
        updatedAt: row.updated_at,
      };
    })
    .sort((a, b) => {
      const titleScore =
        searchMatchScore(trimmed, b.title) - searchMatchScore(trimmed, a.title);
      if (titleScore !== 0) return titleScore;
      return b.updatedAt.localeCompare(a.updatedAt);
    })
    .slice(0, safeLimit);
}

async function searchReviews(
  trimmed: string,
  safeLimit: number,
): Promise<SearchReviewHit[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .not("user_id", "is", null)
    .or(buildIlikeOrFilter(["body", "album_title", "username"], trimmed))
    .order("created_at", { ascending: false })
    .limit(safeLimit * 3);

  if (error || !data) {
    console.error("[Supabase] searchReviews:", error?.message);
    return [];
  }

  return (data as DbReview[])
    .map(mapReview)
    .filter((review) =>
      matchesSearchQuery(
        trimmed,
        review.body,
        review.albumTitle,
        review.username,
      ),
    )
    .sort((a, b) => {
      const albumScore =
        searchMatchScore(trimmed, b.albumTitle) -
        searchMatchScore(trimmed, a.albumTitle);
      if (albumScore !== 0) return albumScore;
      const bodyScore =
        searchMatchScore(trimmed, b.body) - searchMatchScore(trimmed, a.body);
      if (bodyScore !== 0) return bodyScore;
      return b.createdAt.localeCompare(a.createdAt);
    })
    .slice(0, safeLimit)
    .map(
      (review): SearchReviewHit => ({
        type: "review",
        id: review.id,
        albumId: review.albumId,
        albumTitle: review.albumTitle,
        artistId: review.artistId,
        username: review.username,
        snippet: searchResultSnippet(review.body),
        rating: review.rating,
        createdAt: review.createdAt,
      }),
    );
}

async function searchDiscussionPosts(
  trimmed: string,
  safeLimit: number,
): Promise<SearchPostHit[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("discussion_posts")
    .select(POST_SEARCH_COLUMNS)
    .ilike("body", `%${escapeLikePattern(trimmed)}%`)
    .order("created_at", { ascending: false })
    .limit(safeLimit * 4);

  if (error || !data) {
    console.error("[Supabase] searchDiscussionPosts:", error?.message);
    return [];
  }

  const rows = (data as DbPostSearchRow[]).filter((row) =>
    matchesSearchQuery(trimmed, row.body, row.anonymous_name),
  );

  const threadIds = [...new Set(rows.map((row) => row.thread_id))];
  if (threadIds.length === 0) return [];

  const { data: threadRows } = await supabase
    .from("discussion_threads")
    .select("id, title, status")
    .in("id", threadIds)
    .eq("status", "published");

  const threadTitleById = new Map(
    (threadRows ?? []).map((row) => [row.id, row.title as string]),
  );

  return rows
    .filter((row) => threadTitleById.has(row.thread_id))
    .sort(
      (a, b) =>
        searchMatchScore(trimmed, b.body) - searchMatchScore(trimmed, a.body),
    )
    .slice(0, safeLimit)
    .map(
      (row): SearchPostHit => ({
        type: "post",
        id: row.id,
        threadId: row.thread_id,
        threadTitle: threadTitleById.get(row.thread_id) ?? "セッション",
        anonymousName: row.anonymous_name,
        snippet: searchResultSnippet(row.body),
        createdAt: row.created_at,
      }),
    );
}

function toArtistHit(row: DbArtistSearchRow): SearchArtistHit {
  return {
    type: "artist",
    id: row.id,
    name: row.name,
    nameEn: row.name_en ?? undefined,
    imageUrl: row.image_url ?? undefined,
    spotifyId: row.spotify_id ?? undefined,
  };
}

/**
 * アーティスト検索。正規化列 + trigram の RPC(search_artists) を優先し、
 * RPC が未適用（migration 前）などで失敗した場合は全件走査の
 * 正規化マッチにフォールバックする。
 */
async function searchArtists(
  supabase: SupabaseServerClient,
  trimmed: string,
  safeLimit: number,
): Promise<SearchArtistHit[]> {
  const { data, error } = await supabase.rpc("search_artists", {
    q: trimmed,
    result_limit: safeLimit,
  });

  if (!error && data) {
    // RPC は既に similarity 降順で並んでいる
    return (data as DbArtistSearchRpcRow[]).map(toArtistHit);
  }

  console.warn(
    "[Supabase] search_artists RPC unavailable, falling back to scan:",
    error?.message,
  );

  const { data: artistRows, error: scanError } = await supabase
    .from("artists")
    .select(ARTIST_SEARCH_COLUMNS)
    .order("name");

  if (scanError || !artistRows) {
    console.error("[Supabase] searchArtists scan:", scanError?.message);
    return [];
  }

  return (artistRows as DbArtistSearchRow[])
    .filter((row) => matchesSearchQuery(trimmed, row.name, row.name_en))
    .sort(
      (a, b) =>
        searchMatchScore(trimmed, b.name, b.name_en) -
        searchMatchScore(trimmed, a.name, a.name_en),
    )
    .slice(0, safeLimit)
    .map(toArtistHit);
}

/**
 * タイトル一致のアルバム検索。RPC(search_albums) を優先し、
 * 失敗時は ilike 中間一致 + 正規化マッチにフォールバックする。
 */
async function searchAlbumsByTitle(
  supabase: SupabaseServerClient,
  trimmed: string,
  safeLimit: number,
): Promise<DbAlbumSearchRow[]> {
  const { data, error } = await supabase.rpc("search_albums", {
    q: trimmed,
    result_limit: safeLimit * 2,
  });

  if (!error && data) {
    // score 列を落として DbAlbumSearchRow 形に整える（RPC は similarity 降順）
    return (data as DbAlbumSearchRpcRow[]).map(
      (row): DbAlbumSearchRow => ({
        id: row.id,
        title: row.title,
        artist_id: row.artist_id,
        year: row.year,
        cover_url: row.cover_url,
        spotify_id: row.spotify_id,
      }),
    );
  }

  console.warn(
    "[Supabase] search_albums RPC unavailable, falling back to ilike:",
    error?.message,
  );

  const { data: albumRows } = await supabase
    .from("albums")
    .select(ALBUM_SEARCH_COLUMNS)
    .ilike("title", `%${escapeLikePattern(trimmed)}%`)
    .order("year", { ascending: false })
    .limit(safeLimit * 2);

  return (albumRows as DbAlbumSearchRow[] | null) ?? [];
}

export async function searchCatalog(
  query: string,
  limit = 8,
): Promise<SiteSearchResult> {
  if (!isSupabaseConfigured()) {
    return { artists: [], albums: [], threads: [], reviews: [], posts: [] };
  }

  const trimmed = query.trim();
  if (trimmed.length < 1) {
    return { artists: [], albums: [], threads: [], reviews: [], posts: [] };
  }

  const safeLimit = Math.min(20, Math.max(1, limit));

  try {
    const supabase = await createClient();

    // アーティスト: 正規化列 + trigram の RPC（similarity 降順）
    const matchedArtists = await searchArtists(supabase, trimmed, safeLimit);
    const matchedArtistIds = matchedArtists.map((artist) => artist.id);

    // アルバム: タイトル一致（RPC）＋ マッチしたアーティストのアルバム
    const [albumsByTitle, { data: albumsByArtist }] = await Promise.all([
      searchAlbumsByTitle(supabase, trimmed, safeLimit),
      matchedArtistIds.length > 0
        ? supabase
            .from("albums")
            .select(ALBUM_SEARCH_COLUMNS)
            .in("artist_id", matchedArtistIds)
            .order("year", { ascending: false })
            .limit(safeLimit * 2)
        : Promise.resolve({ data: [] as DbAlbumSearchRow[] }),
    ]);

    const albumMap = new Map<string, DbAlbumSearchRow>();
    for (const row of [
      ...albumsByTitle,
      ...(albumsByArtist as DbAlbumSearchRow[] | null ?? []),
    ]) {
      albumMap.set(row.id, row);
    }

    const albumRows = [...albumMap.values()];

    // アルバム表示用のアーティスト名解決（マッチ済みアーティストを起点に）
    const artistNameById = new Map<string, DbArtistSearchRow>(
      matchedArtists.map((artist) => [
        artist.id,
        {
          id: artist.id,
          name: artist.name,
          name_en: artist.nameEn ?? null,
          spotify_id: artist.spotifyId ?? null,
          image_url: artist.imageUrl ?? null,
        } satisfies DbArtistSearchRow,
      ]),
    );

    const missingArtistIds = [
      ...new Set(
        albumRows
          .map((row) => row.artist_id)
          .filter((artistId) => !artistNameById.has(artistId)),
      ),
    ];

    if (missingArtistIds.length > 0) {
      const { data: extraArtists } = await supabase
        .from("artists")
        .select("id, name, name_en")
        .in("id", missingArtistIds);

      for (const row of extraArtists ?? []) {
        artistNameById.set(row.id, row as DbArtistSearchRow);
      }
    }

    const albums = albumRows
      .map((row): SearchAlbumHit => {
        const artist = artistNameById.get(row.artist_id);
        return {
          type: "album",
          id: row.id,
          title: row.title,
          artistId: row.artist_id,
          artistName: artist?.name ?? "",
          artistNameEn: artist?.name_en ?? undefined,
          year: row.year,
          coverUrl: row.cover_url ?? undefined,
          spotifyId: row.spotify_id ?? undefined,
        };
      })
      .filter(
        (album) =>
          matchesSearchQuery(trimmed, album.title) ||
          matchesSearchQuery(trimmed, album.artistName, album.artistNameEn),
      )
      .sort((a, b) => {
        const titleScore =
          searchMatchScore(trimmed, b.title) -
          searchMatchScore(trimmed, a.title);
        if (titleScore !== 0) return titleScore;

        const artistScore =
          searchMatchScore(trimmed, b.artistName, b.artistNameEn) -
          searchMatchScore(trimmed, a.artistName, a.artistNameEn);
        if (artistScore !== 0) return artistScore;

        return b.year - a.year;
      })
      .slice(0, safeLimit);

    const [threads, reviews, posts] = await Promise.all([
      searchThreads(trimmed, safeLimit),
      searchReviews(trimmed, safeLimit),
      searchDiscussionPosts(trimmed, safeLimit),
    ]);

    return { artists: matchedArtists, albums, threads, reviews, posts };
  } catch (err) {
    console.error("[Supabase] searchCatalog:", err);
    return { artists: [], albums: [], threads: [], reviews: [], posts: [] };
  }
}

export function siteSearchTotal(result: SiteSearchResult): number {
  return (
    result.artists.length +
    result.albums.length +
    result.threads.length +
    result.reviews.length +
    result.posts.length
  );
}
