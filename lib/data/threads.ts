import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createStaticClient } from "@/lib/supabase/static";
import { CACHE_REVALIDATE, CACHE_TAGS } from "@/lib/cache/tags";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DbDiscussionCategory,
  DbDiscussionPollOption,
  DbDiscussionPost,
  DbDiscussionThread,
  DbProfile,
} from "@/lib/supabase/types";
import type {
  DiscussionPost,
  DiscussionThread,
  ThreadCategory,
} from "@/lib/types";
import type {
  ThreadDraftFormData,
  ThreadDraftSummary,
} from "@/lib/threads/draft-form";
import { pollOptionsToDrafts } from "@/lib/threads/draft-form";
import { POSTS_PAGE_SIZE, postsPageRange } from "@/lib/threads/posts-pagination";

type ThreadRow = DbDiscussionThread & {
  discussion_posts: { count: number }[];
  discussion_poll_options: { count: number }[];
};

function authorLabel(profile: DbProfile | undefined): string {
  if (!profile) return "ユーザー";
  return profile.display_name?.trim() || profile.username;
}

async function loadAuthorNames(
  authorIds: string[],
  client?: SupabaseClient,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (authorIds.length === 0) return map;

  const supabase = client ?? (await createClient());
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .in("id", authorIds);

  for (const profile of (data ?? []) as DbProfile[]) {
    map.set(profile.id, authorLabel(profile));
  }

  return map;
}

function mapThread(
  row: ThreadRow,
  authorNames: Map<string, string>,
  categoryNames?: Map<string, string>,
): DiscussionThread {
  const postCount = row.discussion_posts?.[0]?.count ?? 0;
  const hasPoll = (row.discussion_poll_options?.[0]?.count ?? 0) > 0;
  const categoryId = row.category_id ?? null;
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    authorId: row.author_id,
    authorName: authorNames.get(row.author_id) ?? "ユーザー",
    status: row.status ?? "published",
    postCount,
    viewCount: row.view_count ?? 0,
    hasPoll,
    reviewId: row.review_id ?? undefined,
    albumId: row.album_id ?? undefined,
    categoryId,
    categoryName:
      categoryId && categoryNames ? categoryNames.get(categoryId) ?? null : null,
    kind: row.review_id ? "album" : "topic",
    featuredRank: row.featured_rank ?? null,
    featuredNote: row.featured_note ?? null,
    lockedAt: row.locked_at ?? null,
    lockReason: row.lock_reason ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * スレ行に含まれる category_id からカテゴリ名を解決するためのマップを引く。
 * カテゴリ一覧（position 順）を渡すことでN+1を避ける。
 */
function buildCategoryNameMap(
  categories: ThreadCategory[],
): Map<string, string> {
  return new Map(categories.map((c) => [c.id, c.name]));
}

function mapPostsWithReplies(rows: DbDiscussionPost[]): DiscussionPost[] {
  const repliesByParent = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.parent_post_id) continue;
    const list = repliesByParent.get(row.parent_post_id) ?? [];
    list.push(row.id);
    repliesByParent.set(row.parent_post_id, list);
  }

  return rows.map((row) => ({
    id: row.id,
    threadId: row.thread_id,
    anonymousName: row.anonymous_name,
    body: row.body,
    parentPostId: row.parent_post_id ?? null,
    replyPostIds: repliesByParent.get(row.id) ?? [],
    authorId: row.author_id ?? null,
    isAnonymous: row.is_anonymous ?? false,
    threadLocalId: row.thread_local_id ?? null,
    createdAt: row.created_at,
  }));
}

export const THREADS_PAGE_SIZE = 10;

/** カテゴリ（板）一覧を position 順で返す。auth 非依存の公開データ。 */
export async function getThreadCategories(): Promise<ThreadCategory[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("discussion_categories")
      .select("id, slug, name, position")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

    if (error || !data) {
      console.error("[Supabase] getThreadCategories:", error?.message);
      return [];
    }

    return (data as DbDiscussionCategory[]).map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      position: row.position,
    }));
  } catch (err) {
    console.error("[Supabase] getThreadCategories:", err);
    return [];
  }
}

export type ThreadSortOrder = "popular" | "newest";

export async function getDiscussionThreadsPage(
  page = 1,
  pageSize = THREADS_PAGE_SIZE,
  sort: ThreadSortOrder = "popular",
  categorySlug?: string,
): Promise<DiscussionThread[]> {
  if (!isSupabaseConfigured()) return [];

  const safePage = Math.max(1, page);
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    const supabase = await createClient();

    // カテゴリ一覧はカテゴリ名解決とスラッグ→ID変換の両方に使う。
    const categories = await getThreadCategories();
    const categoryNames = buildCategoryNameMap(categories);

    let categoryId: string | null | undefined;
    if (categorySlug) {
      categoryId =
        categories.find((c) => c.slug === categorySlug)?.id ?? null;
      // 存在しない slug が来たら結果は空にする（不整合を避ける）。
      if (categoryId === null) return [];
    }

    let query = supabase
      .from("discussion_threads")
      .select("*, discussion_posts ( count ), discussion_poll_options ( count )")
      .eq("status", "published");

    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }

    if (sort === "newest") {
      query = query.order("created_at", { ascending: false });
    } else {
      query = query
        .order("view_count", { ascending: false })
        .order("updated_at", { ascending: false });
    }

    const { data, error } = await query.range(from, to);

    if (error || !data) {
      console.error("[Supabase] getDiscussionThreadsPage:", error?.message);
      return [];
    }

    const rows = data as ThreadRow[];
    const authorIds = [...new Set(rows.map((row) => row.author_id))];
    const authorNames = await loadAuthorNames(authorIds);
    return rows.map((row) => mapThread(row, authorNames, categoryNames));
  } catch (err) {
    console.error("[Supabase] getDiscussionThreadsPage:", err);
    return [];
  }
}

export async function getFeaturedThreads(
  limit = 6,
): Promise<DiscussionThread[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("discussion_threads")
      .select("*, discussion_posts ( count ), discussion_poll_options ( count )")
      .eq("status", "published")
      .not("featured_rank", "is", null)
      .order("featured_rank", { ascending: true })
      .order("featured_at", { ascending: false })
      .limit(limit);

    if (error || !data) {
      console.error("[Supabase] getFeaturedThreads:", error?.message);
      return [];
    }

    const rows = data as ThreadRow[];
    const authorIds = [...new Set(rows.map((row) => row.author_id))];
    const authorNames = await loadAuthorNames(authorIds);
    return rows.map((row) => mapThread(row, authorNames));
  } catch (err) {
    console.error("[Supabase] getFeaturedThreads:", err);
    return [];
  }
}

async function getTrendingThreadsUncached(
  supabase: SupabaseClient,
  limit: number,
): Promise<DiscussionThread[]> {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const recentSince = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("discussion_threads")
      .select("*, discussion_posts ( count ), discussion_poll_options ( count )")
      .eq("status", "published")
      .is("featured_rank", null)
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(Math.max(limit * 3, 12));

    if (error || !data) {
      console.error("[Supabase] getTrendingThreads:", error?.message);
      return [];
    }

    let rows = data as ThreadRow[];

    // 30日以内に更新されたスレが無い場合は、期間条件なしの更新順で母集団を確保する
    // （過疎期に「話題のセッション」が空になるのを防ぐ）。
    if (rows.length === 0) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("discussion_threads")
        .select("*, discussion_posts ( count ), discussion_poll_options ( count )")
        .eq("status", "published")
        .is("featured_rank", null)
        .order("updated_at", { ascending: false })
        .limit(Math.max(limit * 3, 12));

      if (fallbackError) {
        console.error(
          "[Supabase] getTrendingThreads fallback:",
          fallbackError.message,
        );
      }
      rows = (fallbackData ?? []) as ThreadRow[];
    }
    const authorIds = [...new Set(rows.map((row) => row.author_id))];
    const authorNames = await loadAuthorNames(authorIds, supabase);

    const threadIds = rows.map((row) => row.id);
    const recentPostCounts = new Map<string, number>();
    if (threadIds.length > 0) {
      const { data: recentPosts, error: recentPostsError } = await supabase
        .from("discussion_posts")
        .select("thread_id")
        .in("thread_id", threadIds)
        .gte("created_at", recentSince);

      if (recentPostsError) {
        console.error(
          "[Supabase] getTrendingThreads recentPosts:",
          recentPostsError.message,
        );
      } else {
        for (const row of (recentPosts ?? []) as { thread_id: string }[]) {
          recentPostCounts.set(
            row.thread_id,
            (recentPostCounts.get(row.thread_id) ?? 0) + 1,
          );
        }
      }
    }

    const now = Date.now();
    const scoredAll = rows.map((row) => {
      const thread = mapThread(row, authorNames);
      const ageHours =
        (now - new Date(thread.updatedAt).getTime()) / (60 * 60 * 1000);
      const recentPosts = recentPostCounts.get(row.id) ?? 0;
      const recencyBoost = 1 / Math.log2(Math.max(ageHours, 1) + 2);
      const score =
        (recentPosts * 12 +
          thread.viewCount * 0.15 +
          thread.postCount * 2 +
          (thread.hasPoll ? 8 : 0)) *
        recencyBoost;
      // 「直近活動あり」= 72時間以内のレス、または更新から7日以内
      const isActive = recentPosts > 0 || ageHours <= 168;
      return { thread, score, isActive };
    });

    // 直近活動のあるスレを優先。全滅時はセクションを空にせず、
    // スコア順のフォールバックで埋める（過疎期でも「話題」を維持）。
    const active = scoredAll.filter((item) => item.isActive);
    const pool = active.length > 0 ? active : scoredAll;

    return pool
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.thread);
  } catch (err) {
    console.error("[Supabase] getTrendingThreads:", err);
    return [];
  }
}

// トレンドは全ユーザー共通の公開データ。静的クライアント + unstable_cache で
// キャッシュ（feed=120秒 + tag:threads）。スレッド/投稿更新時に無効化される。
const getTrendingThreadsCached = unstable_cache(
  async (limit: number): Promise<DiscussionThread[]> => {
    const supabase = createStaticClient();
    return getTrendingThreadsUncached(supabase, limit);
  },
  ["trending-threads"],
  { revalidate: CACHE_REVALIDATE.feed, tags: [CACHE_TAGS.threads] },
);

export async function getTrendingThreads(
  limit = 5,
): Promise<DiscussionThread[]> {
  if (!isSupabaseConfigured()) return [];
  return getTrendingThreadsCached(limit);
}

async function getUserInterestIds(
  userId: string,
): Promise<{ albumIds: string[]; artistIds: string[] }> {
  const supabase = await createClient();

  const [reviewsRes, tracksRes] = await Promise.all([
    supabase
      .from("reviews")
      .select("album_id, artist_id")
      .eq("user_id", userId),
    supabase
      .from("track_ratings")
      .select("album_id")
      .eq("user_id", userId),
  ]);

  const albumIds = new Set<string>();
  const artistIds = new Set<string>();

  for (const row of (reviewsRes.data ?? []) as {
    album_id: string | null;
    artist_id: string | null;
  }[]) {
    if (row.album_id) albumIds.add(row.album_id);
    if (row.artist_id) artistIds.add(row.artist_id);
  }
  for (const row of (tracksRes.data ?? []) as { album_id: string | null }[]) {
    if (row.album_id) albumIds.add(row.album_id);
  }

  if (albumIds.size > 0 && artistIds.size === 0) {
    const { data: albumArtists } = await supabase
      .from("albums")
      .select("artist_id")
      .in("id", [...albumIds]);
    for (const row of (albumArtists ?? []) as { artist_id: string | null }[]) {
      if (row.artist_id) artistIds.add(row.artist_id);
    }
  }

  return {
    albumIds: [...albumIds],
    artistIds: [...artistIds],
  };
}

export type RecommendedThread = DiscussionThread & {
  matchReason: string;
  matchScore: number;
};

export async function getRecommendedThreadsForUser(
  userId: string,
  limit = 6,
): Promise<RecommendedThread[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createClient();
    const { albumIds, artistIds } = await getUserInterestIds(userId);

    if (albumIds.length === 0 && artistIds.length === 0) {
      return [];
    }

    const [albumOptionsRes, artistOptionsRes] = await Promise.all([
      albumIds.length > 0
        ? supabase
            .from("discussion_poll_options")
            .select("thread_id, album_id")
            .in("album_id", albumIds)
        : Promise.resolve({ data: [] }),
      artistIds.length > 0
        ? supabase
            .from("discussion_poll_options")
            .select("thread_id, artist_id")
            .in("artist_id", artistIds)
        : Promise.resolve({ data: [] }),
    ]);

    const matchByThread = new Map<
      string,
      { albumMatches: number; artistMatches: number }
    >();
    for (const row of (albumOptionsRes.data ?? []) as {
      thread_id: string;
    }[]) {
      const cur = matchByThread.get(row.thread_id) ?? {
        albumMatches: 0,
        artistMatches: 0,
      };
      cur.albumMatches += 1;
      matchByThread.set(row.thread_id, cur);
    }
    for (const row of (artistOptionsRes.data ?? []) as {
      thread_id: string;
    }[]) {
      const cur = matchByThread.get(row.thread_id) ?? {
        albumMatches: 0,
        artistMatches: 0,
      };
      cur.artistMatches += 1;
      matchByThread.set(row.thread_id, cur);
    }

    const threadIds = [...matchByThread.keys()];
    if (threadIds.length === 0) return [];

    const { data: threadsData, error: threadsError } = await supabase
      .from("discussion_threads")
      .select("*, discussion_posts ( count ), discussion_poll_options ( count )")
      .eq("status", "published")
      .in("id", threadIds);

    if (threadsError || !threadsData) {
      console.error(
        "[Supabase] getRecommendedThreadsForUser:",
        threadsError?.message,
      );
      return [];
    }

    const rows = threadsData as ThreadRow[];
    const authorIds = [...new Set(rows.map((row) => row.author_id))];
    const authorNames = await loadAuthorNames(authorIds);

    const scored: RecommendedThread[] = rows.map((row) => {
      const base = mapThread(row, authorNames);
      const match = matchByThread.get(row.id) ?? {
        albumMatches: 0,
        artistMatches: 0,
      };
      const totalMatches = match.albumMatches + match.artistMatches;
      const score =
        totalMatches * 5 + base.viewCount * 0.1 + base.postCount * 2;

      const reason =
        match.albumMatches > 0 && match.artistMatches > 0
          ? "あなたが評価したアルバム・アーティスト"
          : match.albumMatches > 0
            ? "あなたが評価したアルバム"
            : "あなたが評価したアーティスト";

      return { ...base, matchReason: reason, matchScore: score };
    });

    return scored
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);
  } catch (err) {
    console.error("[Supabase] getRecommendedThreadsForUser:", err);
    return [];
  }
}

export async function getDiscussionThreadsByAuthorId(
  authorId: string,
): Promise<DiscussionThread[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("discussion_threads")
      .select("*, discussion_posts ( count ), discussion_poll_options ( count )")
      .eq("author_id", authorId)
      .eq("status", "published")
      .order("created_at", { ascending: false });

    if (error || !data) {
      console.error("[Supabase] getDiscussionThreadsByAuthorId:", error?.message);
      return [];
    }

    const rows = data as ThreadRow[];
    const authorNames = await loadAuthorNames([authorId]);
    return rows.map((row) => mapThread(row, authorNames));
  } catch (err) {
    console.error("[Supabase] getDiscussionThreadsByAuthorId:", err);
    return [];
  }
}

export async function getDiscussionThreadCount(
  categorySlug?: string,
): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  try {
    const supabase = await createClient();

    let categoryId: string | null | undefined;
    if (categorySlug) {
      const categories = await getThreadCategories();
      categoryId = categories.find((c) => c.slug === categorySlug)?.id ?? null;
      if (categoryId === null) return 0;
    }

    let query = supabase
      .from("discussion_threads")
      .select("*", { count: "exact", head: true })
      .eq("status", "published");

    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }

    const { count, error } = await query;

    if (error) {
      console.error("[Supabase] getDiscussionThreadCount:", error.message);
      return 0;
    }

    return count ?? 0;
  } catch (err) {
    console.error("[Supabase] getDiscussionThreadCount:", err);
    return 0;
  }
}

export async function incrementThreadViewCount(threadId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("increment_thread_views", {
      target_id: threadId,
    });

    if (error) {
      console.error("[Supabase] incrementThreadViewCount:", error.message);
    }
  } catch (err) {
    console.error("[Supabase] incrementThreadViewCount:", err);
  }
}

export async function getDiscussionThreadById(
  id: string,
): Promise<DiscussionThread | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("discussion_threads")
      .select("*, discussion_posts ( count ), discussion_poll_options ( count )")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      console.error("[Supabase] getDiscussionThreadById:", error?.message);
      return null;
    }

    const row = data as ThreadRow;
    const [authorNames, categories] = await Promise.all([
      loadAuthorNames([row.author_id]),
      row.category_id ? getThreadCategories() : Promise.resolve([]),
    ]);
    return mapThread(row, authorNames, buildCategoryNameMap(categories));
  } catch (err) {
    console.error("[Supabase] getDiscussionThreadById:", err);
    return null;
  }
}

/** スレのルート（親なし）レス総数。レスページャの分母に使う。 */
export async function getDiscussionRootPostCount(
  threadId: string,
): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("discussion_posts")
      .select("*", { count: "exact", head: true })
      .eq("thread_id", threadId)
      .is("parent_post_id", null);

    if (error) {
      console.error("[Supabase] getDiscussionRootPostCount:", error.message);
      return 0;
    }

    return count ?? 0;
  } catch (err) {
    console.error("[Supabase] getDiscussionRootPostCount:", err);
    return 0;
  }
}

/**
 * スレのレスを「ルートレス単位」でページングして取得する。
 *
 * 1) created_at 昇順でルート（parent_post_id null）レスをページ分だけ取る。
 * 2) それらルートの子孫（返信）を parent_post_id チェーンで全部集める。
 * 3) ルート＋子孫をまとめて mapPostsWithReplies に渡す。
 *
 * 返り値はページ内で返信ツリーが完結するので、buildDiscussionPostTree /
 * buildInitialCollapsedIds はそのまま使える（親がページ外にならない）。
 */
export async function getDiscussionPostsByThreadId(
  threadId: string,
  page = 1,
  pageSize = POSTS_PAGE_SIZE,
): Promise<DiscussionPost[]> {
  if (!isSupabaseConfigured()) return [];

  const { from, to } = postsPageRange(page, pageSize);

  try {
    const supabase = await createClient();

    // 1) このページのルートレス。
    const { data: rootData, error: rootError } = await supabase
      .from("discussion_posts")
      .select("*")
      .eq("thread_id", threadId)
      .is("parent_post_id", null)
      .order("created_at", { ascending: true })
      .range(from, to);

    if (rootError || !rootData) {
      console.error(
        "[Supabase] getDiscussionPostsByThreadId roots:",
        rootError?.message,
      );
      return [];
    }

    const rootRows = rootData as DbDiscussionPost[];
    if (rootRows.length === 0) return [];

    // 2) ルートの子孫を BFS で辿って集める。返信の深さは限られるため反復で十分。
    const collected = new Map<string, DbDiscussionPost>();
    for (const row of rootRows) {
      collected.set(row.id, row);
    }

    let frontier = rootRows.map((row) => row.id);
    // 安全のため深さに上限を設ける（無限ループ防止）。
    for (let depth = 0; depth < 50 && frontier.length > 0; depth += 1) {
      const { data: childData, error: childError } = await supabase
        .from("discussion_posts")
        .select("*")
        .eq("thread_id", threadId)
        .in("parent_post_id", frontier);

      if (childError) {
        console.error(
          "[Supabase] getDiscussionPostsByThreadId children:",
          childError.message,
        );
        break;
      }

      const children = (childData ?? []) as DbDiscussionPost[];
      const nextFrontier: string[] = [];
      for (const child of children) {
        if (collected.has(child.id)) continue;
        collected.set(child.id, child);
        nextFrontier.push(child.id);
      }
      frontier = nextFrontier;
    }

    const rows = [...collected.values()].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    );

    return mapPostsWithReplies(rows);
  } catch (err) {
    console.error("[Supabase] getDiscussionPostsByThreadId:", err);
    return [];
  }
}

/** ユーザーページの「最近のレス」1件分。スレタイトルへのリンク用に threadTitle を含む。 */
export type AuthoredDiscussionPost = {
  id: string;
  threadId: string;
  threadTitle: string;
  body: string;
  createdAt: string;
};

/**
 * 指定ユーザーが「非匿名で」投稿したレスを新しい順に返す。
 *
 * 匿名性厳守: is_anonymous = false のレスのみを対象とする。
 * 匿名表示で投稿したレスは author_id が入っていても公開履歴には出さない。
 * status = 'published' のスレッドに属するレスのみ表示する（下書きスレは除外）。
 */
export async function getDiscussionPostsByAuthorId(
  authorId: string,
  limit = 10,
): Promise<AuthoredDiscussionPost[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("discussion_posts")
      .select(
        "id, thread_id, body, created_at, discussion_threads!inner ( title, status )",
      )
      .eq("author_id", authorId)
      .eq("is_anonymous", false)
      .eq("discussion_threads.status", "published")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) {
      console.error("[Supabase] getDiscussionPostsByAuthorId:", error?.message);
      return [];
    }

    return (
      data as unknown as {
        id: string;
        thread_id: string;
        body: string;
        created_at: string;
        discussion_threads: { title: string; status: string } | null;
      }[]
    ).map((row) => ({
      id: row.id,
      threadId: row.thread_id,
      threadTitle: row.discussion_threads?.title ?? "（無題）",
      body: row.body,
      createdAt: row.created_at,
    }));
  } catch (err) {
    console.error("[Supabase] getDiscussionPostsByAuthorId:", err);
    return [];
  }
}

export async function getUserThreadDrafts(
  userId: string,
): Promise<ThreadDraftSummary[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("discussion_threads")
      .select("id, title, updated_at")
      .eq("author_id", userId)
      .eq("status", "draft")
      .order("updated_at", { ascending: false });

    if (error || !data) {
      console.error("[Supabase] getUserThreadDrafts:", error?.message);
      return [];
    }

    return data.map((row) => ({
      id: row.id,
      title: row.title,
      updatedAt: row.updated_at,
    }));
  } catch (err) {
    console.error("[Supabase] getUserThreadDrafts:", err);
    return [];
  }
}

export async function getThreadDraftForEdit(
  draftId: string,
  userId: string,
): Promise<ThreadDraftFormData | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createClient();
    const { data: thread, error: threadError } = await supabase
      .from("discussion_threads")
      .select("id, author_id, title, body, status, category_id")
      .eq("id", draftId)
      .maybeSingle();

    if (threadError || !thread) {
      console.error("[Supabase] getThreadDraftForEdit:", threadError?.message);
      return null;
    }

    if (thread.author_id !== userId || thread.status !== "draft") {
      return null;
    }

    const { data: pollOptions } = await supabase
      .from("discussion_poll_options")
      .select("*")
      .eq("thread_id", draftId)
      .order("position", { ascending: true });

    const pollState = pollOptionsToDrafts(
      (pollOptions ?? []) as DbDiscussionPollOption[],
    );

    return {
      id: thread.id,
      title: thread.title === "（無題）" ? "" : thread.title,
      body: thread.body,
      categoryId: thread.category_id ?? null,
      enablePoll: pollState.enablePoll,
      addViewOnlyOption: pollState.addViewOnlyOption,
      pollOptions: pollState.pollOptions,
    };
  } catch (err) {
    console.error("[Supabase] getThreadDraftForEdit:", err);
    return null;
  }
}
