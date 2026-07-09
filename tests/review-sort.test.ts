import { describe, it, expect } from "vitest";
import {
  parseReviewSort,
  reviewSortLabel,
  reviewsPageHref,
  sortReviews,
} from "@/lib/reviews/review-sort";
import type { Review } from "@/lib/types";

function review(overrides: Partial<Review> = {}): Review {
  return {
    id: "r1",
    albumId: "al1",
    albumTitle: "タイトル",
    artistId: "ar1",
    username: "user",
    rating: 7,
    body: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("parseReviewSort", () => {
  it("helpfulはそのまま", () => {
    expect(parseReviewSort("helpful")).toBe("helpful");
  });
  it("ratingはそのまま", () => {
    expect(parseReviewSort("rating")).toBe("rating");
  });
  it("undefinedはnewest", () => {
    expect(parseReviewSort(undefined)).toBe("newest");
  });
  it("未知の値はnewest", () => {
    expect(parseReviewSort("xyz")).toBe("newest");
  });
});

describe("reviewSortLabel", () => {
  it("各ソート種別のラベルを返す", () => {
    expect(reviewSortLabel("newest")).toBe("新着順");
    expect(reviewSortLabel("helpful")).toBe("参考になった順");
    expect(reviewSortLabel("rating")).toBe("評価が高い順");
  });
});

describe("sortReviews", () => {
  const older = review({ id: "old", createdAt: "2026-01-01T00:00:00.000Z", rating: 5 });
  const newer = review({ id: "new", createdAt: "2026-01-05T00:00:00.000Z", rating: 8 });
  const middle = review({ id: "mid", createdAt: "2026-01-03T00:00:00.000Z", rating: 9 });

  it("newest: created_at 新しい順", () => {
    const result = sortReviews([older, newer, middle], "newest");
    expect(result.map((r) => r.id)).toEqual(["new", "mid", "old"]);
  });

  it("rating: 評価が高い順（同点は新しい順）", () => {
    const result = sortReviews([older, newer, middle], "rating");
    expect(result.map((r) => r.id)).toEqual(["mid", "new", "old"]);
  });

  it("rating: 同点は created_at 新しい順で並ぶ", () => {
    const a = review({ id: "a", createdAt: "2026-01-01T00:00:00.000Z", rating: 8 });
    const b = review({ id: "b", createdAt: "2026-01-02T00:00:00.000Z", rating: 8 });
    const result = sortReviews([a, b], "rating");
    expect(result.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("helpful: good リアクション数が多い順", () => {
    const goodCounts = new Map([
      ["old", 5],
      ["new", 1],
      ["mid", 3],
    ]);
    const result = sortReviews([older, newer, middle], "helpful", goodCounts);
    expect(result.map((r) => r.id)).toEqual(["old", "mid", "new"]);
  });

  it("helpful: 同数は created_at 新しい順", () => {
    const goodCounts = new Map([
      ["old", 2],
      ["new", 2],
      ["mid", 2],
    ]);
    const result = sortReviews([older, newer, middle], "helpful", goodCounts);
    expect(result.map((r) => r.id)).toEqual(["new", "mid", "old"]);
  });

  it("helpful: goodCountByReviewId が無ければ 0 件扱いで created_at 順", () => {
    const result = sortReviews([older, newer, middle], "helpful");
    expect(result.map((r) => r.id)).toEqual(["new", "mid", "old"]);
  });

  it("元の配列を破壊しない", () => {
    const input = [older, newer, middle];
    const original = [...input];
    sortReviews(input, "rating");
    expect(input).toEqual(original);
  });
});

describe("reviewsPageHref", () => {
  it("newest（デフォルト）はクエリを付けない", () => {
    expect(reviewsPageHref("/albums/al1", { reviewSort: "newest" })).toBe(
      "/albums/al1",
    );
  });

  it("helpfulはクエリを付ける", () => {
    expect(reviewsPageHref("/albums/al1", { reviewSort: "helpful" })).toBe(
      "/albums/al1?reviewSort=helpful",
    );
  });

  it("ratingはクエリを付ける", () => {
    expect(reviewsPageHref("/albums/al1", { reviewSort: "rating" })).toBe(
      "/albums/al1?reviewSort=rating",
    );
  });

  it("hashを付与する", () => {
    expect(
      reviewsPageHref("/albums/al1", { reviewSort: "helpful", hash: "reviews" }),
    ).toBe("/albums/al1?reviewSort=helpful#reviews");
  });

  it("パラメータなしはbasePathのみ", () => {
    expect(reviewsPageHref("/albums/al1", {})).toBe("/albums/al1");
  });
});
