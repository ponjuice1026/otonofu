import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type UserProfileStats = {
  reviewCount: number;
  receivedGoods: number;
  receivedBads: number;
  threadCount: number;
};

export async function getUserProfileStats(
  userId: string,
): Promise<UserProfileStats> {
  const empty: UserProfileStats = {
    reviewCount: 0,
    receivedGoods: 0,
    receivedBads: 0,
    threadCount: 0,
  };

  if (!isSupabaseConfigured()) return empty;

  try {
    const supabase = await createClient();

    const { data: reviews, error: reviewsError } = await supabase
      .from("reviews")
      .select("id")
      .eq("user_id", userId);

    if (reviewsError) {
      console.error("[Supabase] getUserProfileStats reviews:", reviewsError.message);
      return empty;
    }

    const reviewIds = (reviews ?? []).map((r) => (r as { id: string }).id);

    const [reactionsRes, threadCountRes] = await Promise.all([
      reviewIds.length > 0
        ? supabase
            .from("review_reactions")
            .select("reaction")
            .in("review_id", reviewIds)
        : Promise.resolve({ data: [] }),
      supabase
        .from("discussion_threads")
        .select("*", { count: "exact", head: true })
        .eq("author_id", userId)
        .eq("status", "published"),
    ]);

    let good = 0;
    let bad = 0;
    for (const row of (reactionsRes.data ?? []) as { reaction: string }[]) {
      if (row.reaction === "good") good += 1;
      else if (row.reaction === "bad") bad += 1;
    }

    return {
      reviewCount: reviewIds.length,
      receivedGoods: good,
      receivedBads: bad,
      threadCount: threadCountRes.count ?? 0,
    };
  } catch (err) {
    console.error("[Supabase] getUserProfileStats:", err);
    return empty;
  }
}
