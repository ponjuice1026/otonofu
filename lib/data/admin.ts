import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { DbDiscussionThread, DbProfile } from "@/lib/supabase/types";

export type AdminStats = {
  pendingReports: number;
  totalThreads: number;
  totalPosts: number;
  totalVotes: number;
  totalUsers: number;
  totalAdmins: number;
};

export async function getAdminStats(): Promise<AdminStats> {
  const zero: AdminStats = {
    pendingReports: 0,
    totalThreads: 0,
    totalPosts: 0,
    totalVotes: 0,
    totalUsers: 0,
    totalAdmins: 0,
  };

  if (!isSupabaseConfigured()) return zero;

  try {
    const supabase = await createClient();

    const [threads, posts, votes, users, admins, reports] = await Promise.all([
      supabase
        .from("discussion_threads")
        .select("*", { count: "exact", head: true }),
      supabase
        .from("discussion_posts")
        .select("*", { count: "exact", head: true }),
      supabase
        .from("discussion_poll_votes")
        .select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("is_admin", true),
      supabase
        .from("content_reports")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);

    return {
      pendingReports: reports.count ?? 0,
      totalThreads: threads.count ?? 0,
      totalPosts: posts.count ?? 0,
      totalVotes: votes.count ?? 0,
      totalUsers: users.count ?? 0,
      totalAdmins: admins.count ?? 0,
    };
  } catch (err) {
    console.error("[Supabase] getAdminStats:", err);
    return zero;
  }
}

export type AdminThreadRow = {
  id: string;
  title: string;
  authorName: string;
  authorId: string;
  viewCount: number;
  postCount: number;
  createdAt: string;
  kind: "album" | "topic";
  featuredRank: number | null;
  featuredNote: string | null;
};

export async function getAdminThreads(limit = 50): Promise<AdminThreadRow[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("discussion_threads")
      .select("*, discussion_posts ( count )")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) {
      console.error("[Supabase] getAdminThreads:", error?.message);
      return [];
    }

    type Row = DbDiscussionThread & {
      discussion_posts: { count: number }[];
    };

    const rows = data as Row[];
    const authorIds = [...new Set(rows.map((row) => row.author_id))];

    const profileMap = new Map<string, string>();
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .in("id", authorIds);

      for (const profile of (profiles ?? []) as DbProfile[]) {
        profileMap.set(
          profile.id,
          profile.display_name?.trim() || profile.username,
        );
      }
    }

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      authorId: row.author_id,
      authorName: profileMap.get(row.author_id) ?? "ユーザー",
      viewCount: row.view_count ?? 0,
      postCount: row.discussion_posts?.[0]?.count ?? 0,
      createdAt: row.created_at,
      kind: row.review_id ? "album" : "topic",
      featuredRank: row.featured_rank ?? null,
      featuredNote: row.featured_note ?? null,
    }));
  } catch (err) {
    console.error("[Supabase] getAdminThreads:", err);
    return [];
  }
}

export type AdminUserRow = {
  id: string;
  email: string | null;
  username: string;
  displayName: string | null;
  isAdmin: boolean;
  createdAt: string;
};

/** Service role を使うので注意 */
export async function getAdminUsers(limit = 100): Promise<AdminUserRow[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const admin = createAdminClient();

    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (profilesError || !profiles) {
      console.error("[Supabase] getAdminUsers profiles:", profilesError?.message);
      return [];
    }

    const emailMap = new Map<string, string>();
    try {
      const { data: usersData } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: Math.min(limit, 1000),
      });
      for (const user of usersData?.users ?? []) {
        if (user.email) emailMap.set(user.id, user.email);
      }
    } catch (err) {
      console.error("[Supabase] auth.admin.listUsers:", err);
    }

    return (profiles as DbProfile[]).map((profile) => ({
      id: profile.id,
      email: emailMap.get(profile.id) ?? null,
      username: profile.username,
      displayName: profile.display_name,
      isAdmin: profile.is_admin === true,
      createdAt: profile.created_at,
    }));
  } catch (err) {
    console.error("[Supabase] getAdminUsers:", err);
    return [];
  }
}
