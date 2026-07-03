import { describe, it, expect } from "vitest";
import { checkContent, BANNED_PATTERNS } from "@/lib/moderation";

describe("checkContent", () => {
  it("通常の本文はnull", () => {
    expect(checkContent("これは普通の投稿です。")).toBeNull();
  });

  it("空文字列はnull", () => {
    expect(checkContent("")).toBeNull();
  });

  it("URL5個までは許容する", () => {
    const body = Array.from({ length: 5 }, (_, i) => `https://example.com/${i}`).join(" ");
    expect(checkContent(body)).toBeNull();
  });

  it("URL6個はエラー（上限5超過）", () => {
    const body = Array.from({ length: 6 }, (_, i) => `https://example.com/${i}`).join(" ");
    expect(checkContent(body)).toBe("URL が多すぎます。数を減らして再度お試しください。");
  });

  it("同一文字30連続は許容する", () => {
    expect(checkContent("あ".repeat(30))).toBeNull();
  });

  it("同一文字31連続はエラー（31文字目で(.)\\1{30}に一致）", () => {
    expect(checkContent("あ".repeat(31))).toBe(
      "同じ文字の繰り返しが多すぎます。内容を見直してください。",
    );
  });

  it("BANNED_PATTERNSはデフォルトで空", () => {
    expect(BANNED_PATTERNS).toEqual([]);
  });
});
