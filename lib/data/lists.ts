import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { DbUserList, DbUserListItem } from "@/lib/supabase/types";
import type { UserList, UserListItem } from "@/lib/types";

const COVER_COLLAGE_LIMIT = 4;

type AlbumMeta = {
  title: string;
  artistId: string;
  artistName: string;
  year: number;
  coverUrl?: string;
  coverColor: string;
  spotifyId?: string;
};

async function loadAuthorNames(
  authorIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (authorIds.length === 0) return map;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .in("id", [...new Set(authorIds)]);

  for (const row of data ?? []) {
    const name = row.display_name?.trim() || row.username?.trim() || "ユーザー";
    map.set(row.id, name);
  }

  return map;
}

async function loadAlbumMeta(
  albumIds: string[],
): Promise<Map<string, AlbumMeta>> {
  const map = new Map<string, AlbumMeta>();
  const unique = [...new Set(albumIds)];
  if (unique.length === 0) return map;

  const supabase = await createClient();
  const { data } = await supabase
    .from("albums")
    .select("id, title, artist_id, year, cover_url, cover_color, spotify_id")
    .in("id", unique);

  const artistIds = [
    ...new Set((data ?? []).map((row) => row.artist_id as string)),
  ];
  const artistNames = new Map<string, string>();
  if (artistIds.length > 0) {
    const { data: artists } = await supabase
      .from("artists")
      .select("id, name")
      .in("id", artistIds);
    for (const row of artists ?? []) {
      artistNames.set(row.id, row.name as string);
    }
  }

  for (const row of data ?? []) {
    map.set(row.id, {
      title: row.title,
      artistId: row.artist_id,
      artistName: artistNames.get(row.artist_id) ?? "",
      year: row.year,
      coverUrl: row.cover_url ?? undefined,
      coverColor: row.cover_color ?? "#333333",
      spotifyId: row.spotify_id ?? undefined,
    });
  }

  return map;
}

function mapListItem(
  row: DbUserListItem,
  albumMeta: Map<string, AlbumMeta>,
): UserListItem {
  const meta = albumMeta.get(row.album_id);
  return {
    id: row.id,
    listId: row.list_id,
    albumId: row.album_id,
    position: row.position,
    note: row.note ?? undefined,
    albumTitle: meta?.title ?? row.album_id,
    artistId: meta?.artistId ?? "",
    artistName: meta?.artistName ?? "",
    year: meta?.year ?? 0,
    coverUrl: meta?.coverUrl,
    coverColor: meta?.coverColor ?? "#333333",
    spotifyId: meta?.spotifyId,
  };
}

/**
 * 一覧カード用に、各リストの件数とカバーコラージュ（先頭数件）を組み立てる。
 * items は空配列（詳細取得時のみ埋める）。
 */
async function assembleListSummaries(
  rows: DbUserList[],
): Promise<UserList[]> {
  if (rows.length === 0) return [];

  const supabase = await createClient();
  const listIds = rows.map((row) => row.id);

  const { data: itemRows } = await supabase
    .from("user_list_items")
    .select("id, list_id, album_id, position, note")
    .in("list_id", listIds)
    .order("position", { ascending: true });

  const itemsByList = new Map<string, DbUserListItem[]>();
  for (const item of (itemRows ?? []) as DbUserListItem[]) {
    const arr = itemsByList.get(item.list_id) ?? [];
    arr.push(item);
    itemsByList.set(item.list_id, arr);
  }

  const collageAlbumIds = new Set<string>();
  for (const list of itemsByList.values()) {
    for (const item of list.slice(0, COVER_COLLAGE_LIMIT)) {
      collageAlbumIds.add(item.album_id);
    }
  }

  const [authorNames, albumMeta] = await Promise.all([
    loadAuthorNames(rows.map((row) => row.author_id)),
    loadAlbumMeta([...collageAlbumIds]),
  ]);

  return rows.map((row) => {
    const items = itemsByList.get(row.id) ?? [];
    return {
      id: row.id,
      authorId: row.author_id,
      authorName: authorNames.get(row.author_id) ?? "ユーザー",
      title: row.title,
      description: row.description ?? undefined,
      isPublic: row.is_public,
      itemCount: items.length,
      coverItems: items.slice(0, COVER_COLLAGE_LIMIT).map((item) => {
        const meta = albumMeta.get(item.album_id);
        return {
          albumId: item.album_id,
          coverUrl: meta?.coverUrl,
          coverColor: meta?.coverColor ?? "#333333",
          spotifyId: meta?.spotifyId,
        };
      }),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      items: [],
    };
  });
}

const LIST_PAGE_SIZE = 50;

export const PUBLIC_LISTS_PAGE_SIZE = 24;

/**
 * 公開リスト一覧（新着順・件数指定での一括取得）。
 * サイトマップ等、ページングせず上位N件をまとめて欲しい呼び出し向け。
 */
export async function getPublicLists(
  limit = LIST_PAGE_SIZE,
): Promise<UserList[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("user_lists")
      .select("*")
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) {
      console.error("[Supabase] getPublicLists:", error?.message);
      return [];
    }

    return assembleListSummaries(data as DbUserList[]);
  } catch (err) {
    console.error("[Supabase] getPublicLists:", err);
    return [];
  }
}

/** 公開リスト一覧（ページング対応・新着順） */
export async function getPublicListsPage(
  page: number,
  pageSize = PUBLIC_LISTS_PAGE_SIZE,
): Promise<UserList[]> {
  if (!isSupabaseConfigured()) return [];

  const safePage = Math.max(1, page);
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("user_lists")
      .select("*")
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error || !data) {
      console.error("[Supabase] getPublicListsPage:", error?.message);
      return [];
    }

    return assembleListSummaries(data as DbUserList[]);
  } catch (err) {
    console.error("[Supabase] getPublicListsPage:", err);
    return [];
  }
}

/** 公開リストの総件数 */
export async function getPublicListsCount(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("user_lists")
      .select("*", { count: "exact", head: true })
      .eq("is_public", true);

    if (error) {
      console.error("[Supabase] getPublicListsCount:", error.message);
      return 0;
    }

    return count ?? 0;
  } catch (err) {
    console.error("[Supabase] getPublicListsCount:", err);
    return 0;
  }
}

/**
 * 指定ユーザーのリスト一覧。
 * viewerIsOwner が false の場合は公開リストのみ返す（RLS で保証されるが二重に絞る）。
 */
export async function getListsByAuthorId(
  authorId: string,
  viewerIsOwner: boolean,
): Promise<UserList[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createClient();
    let query = supabase
      .from("user_lists")
      .select("*")
      .eq("author_id", authorId)
      .order("created_at", { ascending: false });

    if (!viewerIsOwner) {
      query = query.eq("is_public", true);
    }

    const { data, error } = await query;

    if (error || !data) {
      console.error("[Supabase] getListsByAuthorId:", error?.message);
      return [];
    }

    return assembleListSummaries(data as DbUserList[]);
  } catch (err) {
    console.error("[Supabase] getListsByAuthorId:", err);
    return [];
  }
}

/**
 * リスト詳細。非公開リストは RLS により本人以外は取得不可（null を返す）。
 */
export async function getListById(id: string): Promise<UserList | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createClient();
    const { data: listRow, error } = await supabase
      .from("user_lists")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !listRow) {
      if (error) console.error("[Supabase] getListById:", error.message);
      return null;
    }

    const row = listRow as DbUserList;

    const { data: itemRows } = await supabase
      .from("user_list_items")
      .select("id, list_id, album_id, position, note")
      .eq("list_id", id)
      .order("position", { ascending: true });

    const dbItems = (itemRows ?? []) as DbUserListItem[];

    const [authorNames, albumMeta] = await Promise.all([
      loadAuthorNames([row.author_id]),
      loadAlbumMeta(dbItems.map((item) => item.album_id)),
    ]);

    const items = dbItems.map((item) => mapListItem(item, albumMeta));

    return {
      id: row.id,
      authorId: row.author_id,
      authorName: authorNames.get(row.author_id) ?? "ユーザー",
      title: row.title,
      description: row.description ?? undefined,
      isPublic: row.is_public,
      itemCount: items.length,
      coverItems: items.slice(0, COVER_COLLAGE_LIMIT).map((item) => ({
        albumId: item.albumId,
        coverUrl: item.coverUrl,
        coverColor: item.coverColor,
        spotifyId: item.spotifyId,
      })),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      items,
    };
  } catch (err) {
    console.error("[Supabase] getListById:", err);
    return null;
  }
}

/**
 * 「リストに追加」ドロップダウン用: ログインユーザー自身のリスト（軽量）。
 * 各リストに、指定アルバムが既に含まれているかのフラグを付ける。
 */
export type OwnListOption = {
  id: string;
  title: string;
  isPublic: boolean;
  containsAlbum: boolean;
};

export async function getOwnListsForAlbum(
  authorId: string,
  albumId: string,
): Promise<OwnListOption[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("user_lists")
      .select("id, title, is_public")
      .eq("author_id", authorId)
      .order("created_at", { ascending: false });

    if (error || !data) {
      console.error("[Supabase] getOwnListsForAlbum:", error?.message);
      return [];
    }

    const listIds = data.map((row) => row.id as string);
    const containing = new Set<string>();
    if (listIds.length > 0) {
      const { data: itemRows } = await supabase
        .from("user_list_items")
        .select("list_id")
        .eq("album_id", albumId)
        .in("list_id", listIds);
      for (const row of itemRows ?? []) {
        containing.add(row.list_id as string);
      }
    }

    return data.map((row) => ({
      id: row.id,
      title: row.title,
      isPublic: row.is_public,
      containsAlbum: containing.has(row.id),
    }));
  } catch (err) {
    console.error("[Supabase] getOwnListsForAlbum:", err);
    return [];
  }
}
