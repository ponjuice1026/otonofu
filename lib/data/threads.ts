import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type {
  DbDiscussionPollOption,
  DbDiscussionPost,
  DbDiscussionThread,
  DbProfile,
} from "@/lib/supabase/types";
import type { DiscussionPost, DiscussionThread } from "@/lib/types";
import type {
  ThreadDraftFormData,
  ThreadDraftSummary,
} from "@/lib/threads/draft-form";
import { pollOptionsToDrafts } from "@/lib/threads/draft-form";

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
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (authorIds.length === 0) return map;

  const supabase = await createClient();
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
): DiscussionThread {
  const postCount = row.discussion_posts?.[0]?.count ?? 0;
  const hasPoll = (row.discussion_poll_options?.[0]?.count ?? 0) > 0;
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
    kind: row.review_id ? "album" : "topic",
    featuredRank: row.featured_rank ?? null,
    featuredNote: row.featured_note ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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

export type ThreadSortOrder = "popular" | "newest";

export async function getDiscussionThreadsPage(
  page = 1,
  pageSize = THREADS_PAGE_SIZE,
  sort: ThreadSortOrder = "popular",
): Promise<DiscussionThread[]> {
  if (!isSupabaseConfigured()) return [];

  const safePage = Math.max(1, page);
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    const supabase = await createClient();
    let query = supabase
      .from("discussion_threads")
      .select("*, discussion_posts ( count ), discussion_poll_options ( count )")
      .eq("status", "published");

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
    return rows.map((row) => mapThread(row, authorNames));
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

export async function getTrendingThreads(
  limit = 5,
): Promise<DiscussionThread[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createClient();
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

    const rows = data as ThreadRow[];
    const authorIds = [...new Set(rows.map((row) => row.author_id))];
    const authorNames = await loadAuthorNames(authorIds);

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
    const scored = rows
      .map((row) => {
        const thread = mapThread(row, authorNames);
        const ageHours =
          (now - new Date(thread.updatedAt).getTime()) / (60 * 60 * 1000);
        const recentPosts = recentPostCounts.get(row.id) ?? 0;
        if (recentPosts === 0 && ageHours > 168) {
          return null;
        }
        const recencyBoost = 1 / Math.log2(Math.max(ageHours, 1) + 2);
        const score =
          (recentPosts * 12 +
            thread.viewCount * 0.15 +
            thread.postCount * 2 +
            (thread.hasPoll ? 8 : 0)) *
          recencyBoost;
        return { thread, score };
      })
      .filter((item): item is { thread: DiscussionThread; score: number } =>
        item !== null,
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map((item) => item.thread);
  } catch (err) {
    console.error("[Supabase] getTrendingThreads:", err);
    return [];
  }
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

export async function getDiscussionThreadCount(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("discussion_threads")
      .select("*", { count: "exact", head: true })
      .eq("status", "published");

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
    const authorNames = await loadAuthorNames([row.author_id]);
    return mapThread(row, authorNames);
  } catch (err) {
    console.error("[Supabase] getDiscussionThreadById:", err);
    return null;
  }
}

export async function getDiscussionPostsByThreadId(
  threadId: string,
): Promise<DiscussionPost[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("discussion_posts")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (error || !data) {
      console.error("[Supabase] getDiscussionPostsByThreadId:", error?.message);
      return [];
    }

    return mapPostsWithReplies(data as DbDiscussionPost[]);
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
      .select("id, author_id, title, body, status")
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
      enablePoll: pollState.enablePoll,
      addViewOnlyOption: pollState.addViewOnlyOption,
      pollOptions: pollState.pollOptions,
    };
  } catch (err) {
    console.error("[Supabase] getThreadDraftForEdit:", err);
    return null;
  }
}
