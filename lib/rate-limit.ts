import { getUser } from "@/lib/auth/session";
import { getOrCreateVoterKey } from "@/lib/threads/voter";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * レート制限で拒否されたときに Server Action が返す日本語メッセージ。
 * 各アクションは自身のエラー返却形式に合わせてこの文字列を使う。
 */
export const RATE_LIMIT_MESSAGE =
  "投稿間隔が短すぎます。しばらく待ってから再度お試しください。";

/** 各アクションの制限値。指示書の目安に準拠。 */
export const RATE_LIMITS = {
  thread_create: { maxCount: 3, windowSeconds: 60 * 60 }, // スレ作成 3/時
  post_create: { maxCount: 10, windowSeconds: 60 }, // 投稿 10/分
  review_comment: { maxCount: 5, windowSeconds: 60 * 60 }, // レビュー(コメント) 5/時
  reaction: { maxCount: 30, windowSeconds: 60 }, // リアクション 30/分
  report: { maxCount: 10, windowSeconds: 60 * 60 }, // 通報 10/時
  list_create: { maxCount: 10, windowSeconds: 60 * 60 }, // リスト作成 10/時
  follow: { maxCount: 60, windowSeconds: 60 }, // フォロー 60/分
  contribution: { maxCount: 5, windowSeconds: 60 * 60 * 24 }, // データ申請 5/日
} as const;

export type RateLimitAction = keyof typeof RATE_LIMITS;

/**
 * レート制限をチェックし、上限未満ならイベントを記録して true を返す。
 * 上限超過・重複投稿なら false を返す（このとき呼び出し側は拒否メッセージを返す）。
 *
 * key はログインユーザーなら user:<id>、匿名なら voter:<voter_key>。
 * dedupBody を渡すと同一 key・同一本文の 60 秒以内の連投を拒否する。
 *
 * Supabase 未設定や RPC エラー時は true（=通す）を返し、正常系を妨げない。
 */
export async function checkRateLimit(
  action: RateLimitAction,
  options?: { dedupBody?: string },
): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;

  const limit = RATE_LIMITS[action];

  let key: string;
  try {
    const user = await getUser();
    key = user ? `user:${user.id}` : `voter:${await getOrCreateVoterKey()}`;
  } catch {
    // key が取れない場合は制限をかけない
    return true;
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("check_rate_limit", {
      limit_key: key,
      limit_action: action,
      max_count: limit.maxCount,
      window_seconds: limit.windowSeconds,
      dedup_body: options?.dedupBody ?? null,
      dedup_window_seconds: 60,
    });

    if (error) {
      // RPC 失敗時は投稿を妨げない（可用性優先）
      console.error("[rate-limit] check_rate_limit:", error.message);
      return true;
    }

    return data === true;
  } catch (err) {
    console.error("[rate-limit] check_rate_limit:", err);
    return true;
  }
}
