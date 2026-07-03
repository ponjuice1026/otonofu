import { describe, it, expect } from "vitest";
import { RATE_LIMITS, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";

// checkRateLimit は Supabase / セッションに依存する非同期関数のため、
// ここでは純粋な設定値（定数）のみを検証する。
// 依存注入されていないため副作用のあるロジックのユニットテストは見送る（記録: 下記）。

describe("RATE_LIMITS", () => {
  it("スレ作成は 3回/時", () => {
    expect(RATE_LIMITS.thread_create).toEqual({ maxCount: 3, windowSeconds: 3600 });
  });

  it("投稿は 10回/分", () => {
    expect(RATE_LIMITS.post_create).toEqual({ maxCount: 10, windowSeconds: 60 });
  });

  it("フォローは 60回/分", () => {
    expect(RATE_LIMITS.follow).toEqual({ maxCount: 60, windowSeconds: 60 });
  });

  it("全アクションでmaxCount/windowSecondsが正の数", () => {
    for (const limit of Object.values(RATE_LIMITS)) {
      expect(limit.maxCount).toBeGreaterThan(0);
      expect(limit.windowSeconds).toBeGreaterThan(0);
    }
  });

  it("期待するアクションキーが揃っている", () => {
    expect(Object.keys(RATE_LIMITS).sort()).toEqual(
      [
        "follow",
        "list_create",
        "post_create",
        "reaction",
        "report",
        "review_comment",
        "thread_create",
      ].sort(),
    );
  });
});

describe("RATE_LIMIT_MESSAGE", () => {
  it("日本語の拒否メッセージ", () => {
    expect(RATE_LIMIT_MESSAGE).toBe(
      "投稿間隔が短すぎます。しばらく待ってから再度お試しください。",
    );
  });
});
