import { mapReview } from "@/lib/data/mappers";
import { getThreadIdsByReviewIds } from "@/lib/reviews/review-session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { DbProfile, DbReview } from "@/lib/supabase/types";
import type { Review } from "@/lib/types";

export type FollowCounts = {
  /** このユーザーをフォローしている人数 */
  followers: number;
  /** このユーザーがフォローしている人数 */
  following: number;
};

/** フォロー相手として一覧表示する最小限のプロフィール情報 */
export type FollowUser = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string;
  followedAt: string;
};

/** userId のフォロワー数・フォロー数を取得 */
export async function getFollowCounts(userId: string): Promise<FollowCounts> {
  const empty: FollowCounts = { followers: 0, following: 0 };
  if (!isSupabaseConfigured()) return empty;

  try {
    const supabase = await createClient();
    const [followersRes, followingRes] = await Promise.all([
      supabase
        .from("user_follows")
        .select("*", { count: "exact", head: true })
        .eq("followee_id", userId),
      supabase
        .from("user_follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", userId),
    ]);

    return {
      followers: followersRes.count ?? 0,
      following: followingRes.count ?? 0,
    };
  } catch (err) {
    console.error("[Supabase] getFollowCounts:", err);
    return empty;
  }
}

/** viewerId が targetId をフォロー済みか */
export async function isFollowing(
  viewerId: string,
  targetId: string,
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  if (viewerId === targetId) return false;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("user_follows")
      .select("follower_id")
      .eq("follower_id", viewerId)
      .eq("followee_id", targetId)
      .maybeSingle();

    if (error) {
      console.error("[Supabase] isFollowing:", error.message);
      return false;
    }
    return Boolean(data);
  } catch (err) {
    console.error("[Supabase] isFollowing:", err);
    return false;
  }
}

/** userId がフォローしているユーザーIDの一覧 */
export async function getFolloweeIds(userId: string): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("user_follows")
      .select("followee_id")
      .eq("follower_id", userId);

    if (error || !data) {
      console.error("[Supabase] getFolloweeIds:", error?.message);
      return [];
    }
    return (data as { followee_id: string }[]).map((row) => row.followee_id);
  } catch (err) {
    console.error("[Supabase] getFolloweeIds:", err);
    return [];
  }
}

type FollowDirection = "followers" | "following";

async function getFollowUsers(
  userId: string,
  direction: FollowDirection,
): Promise<FollowUser[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createClient();
    // followers: userId をフォローしている人 = follower_id を集める
    // following: userId がフォローしている人 = followee_id を集める
    const selfColumn =
      direction === "followers" ? "followee_id" : "follower_id";
    const otherColumn =
      direction === "followers" ? "follower_id" : "followee_id";

    const { data: follows, error } = await supabase
      .from("user_follows")
      .select(`${otherColumn}, created_at`)
      .eq(selfColumn, userId)
      .order("created_at", { ascending: false });

    if (error || !follows) {
      console.error(`[Supabase] getFollowUsers(${direction}):`, error?.message);
      return [];
    }

    const rows = follows as Record<string, string>[];
    const orderedIds = rows.map((row) => row[otherColumn]);
    const followedAtById = new Map(
      rows.map((row) => [row[otherColumn], row.created_at]),
    );

    if (orderedIds.length === 0) return [];

    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio")
      .in("id", orderedIds);

    if (profileError || !profiles) {
      console.error(
        `[Supabase] getFollowUsers(${direction}) profiles:`,
        profileError?.message,
      );
      return [];
    }

    const profileById = new Map(
      (profiles as Pick<
        DbProfile,
        "id" | "username" | "display_name" | "avatar_url" | "bio"
      >[]).map((profile) => [profile.id, profile]),
    );

    // created_at の新しい順（フォロー一覧の並び）を保ったまま解決
    return orderedIds
      .map((id) => {
        const profile = profileById.get(id);
        if (!profile) return null;
        return {
          id: profile.id,
          username: profile.username,
          displayName: profile.display_name,
          avatarUrl: profile.avatar_url,
          bio: profile.bio,
          followedAt: followedAtById.get(id) ?? "",
        } satisfies FollowUser;
      })
      .filter((user): user is FollowUser => user !== null);
  } catch (err) {
    console.error(`[Supabase] getFollowUsers(${direction}):`, err);
    return [];
  }
}

/** userId のフォロワー（userId をフォローしている人）一覧 */
export function getFollowers(userId: string): Promise<FollowUser[]> {
  return getFollowUsers(userId, "followers");
}

/** userId がフォローしている人一覧 */
export function getFollowing(userId: string): Promise<FollowUser[]> {
  return getFollowUsers(userId, "following");
}

/**
 * userId がフォローしているユーザーたちの新着レビューを取得する。
 * ホームの「フォロー中のユーザーの新着レビュー」セクション用。
 */
export async function getFollowingRecentReviews(
  userId: string,
  limit = 6,
): Promise<Review[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const followeeIds = await getFolloweeIds(userId);
    if (followeeIds.length === 0) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .in("user_id", followeeIds)
      .not("user_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) {
      console.error("[Supabase] getFollowingRecentReviews:", error?.message);
      return [];
    }

    const reviews = (data as DbReview[]).map(mapReview);
    if (reviews.length === 0) return [];

    // セッション（スレッド）へのリンク解決（reviews.ts の attachThreadIds と同方針）
    const threadIds = await getThreadIdsByReviewIds(
      supabase,
      reviews.filter((review) => !review.sessionOptOut).map((review) => review.id),
    );

    return reviews.map((review) => ({
      ...review,
      threadId: threadIds.get(review.id),
    }));
  } catch (err) {
    console.error("[Supabase] getFollowingRecentReviews:", err);
    return [];
  }
}
