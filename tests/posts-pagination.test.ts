import { describe, it, expect } from "vitest";
import {
  POSTS_PAGE_SIZE,
  normalizePostsPage,
  postsPageRange,
  totalPostsPages,
} from "@/lib/threads/posts-pagination";

describe("POSTS_PAGE_SIZE", () => {
  it("正の整数である", () => {
    expect(POSTS_PAGE_SIZE).toBeGreaterThan(0);
    expect(Number.isInteger(POSTS_PAGE_SIZE)).toBe(true);
  });
});

describe("normalizePostsPage", () => {
  it("1以上はそのまま（整数化）", () => {
    expect(normalizePostsPage(1)).toBe(1);
    expect(normalizePostsPage(5)).toBe(5);
    expect(normalizePostsPage(3.7)).toBe(3);
  });

  it("0以下・NaN・非有限は1に丸める", () => {
    expect(normalizePostsPage(0)).toBe(1);
    expect(normalizePostsPage(-4)).toBe(1);
    expect(normalizePostsPage(Number.NaN)).toBe(1);
    expect(normalizePostsPage(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe("totalPostsPages", () => {
  it("ちょうど割り切れる場合", () => {
    expect(totalPostsPages(200, 100)).toBe(2);
    expect(totalPostsPages(100, 100)).toBe(1);
  });

  it("端数は切り上げる", () => {
    expect(totalPostsPages(101, 100)).toBe(2);
    expect(totalPostsPages(250, 100)).toBe(3);
  });

  it("0件でも最低1ページ", () => {
    expect(totalPostsPages(0, 100)).toBe(1);
  });

  it("pageSizeが0以下でも1を返す（防御）", () => {
    expect(totalPostsPages(500, 0)).toBe(1);
  });

  it("デフォルトのページサイズを使う", () => {
    expect(totalPostsPages(POSTS_PAGE_SIZE + 1)).toBe(2);
  });
});

describe("postsPageRange", () => {
  it("1ページ目は0始まり", () => {
    expect(postsPageRange(1, 100)).toEqual({ from: 0, to: 99 });
  });

  it("2ページ目は次のブロック", () => {
    expect(postsPageRange(2, 100)).toEqual({ from: 100, to: 199 });
  });

  it("不正なページは1ページ目扱い", () => {
    expect(postsPageRange(0, 100)).toEqual({ from: 0, to: 99 });
    expect(postsPageRange(-1, 100)).toEqual({ from: 0, to: 99 });
  });

  it("小さいページサイズ", () => {
    expect(postsPageRange(3, 10)).toEqual({ from: 20, to: 29 });
  });
});
