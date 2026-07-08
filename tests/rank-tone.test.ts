import { describe, it, expect } from "vitest";
import { formatRankLabel, rankNumClass } from "@/lib/rank-tone";

describe("formatRankLabel", () => {
  it("prefixes the rank with # so it reads as a ranking, not a raw count", () => {
    expect(formatRankLabel(1)).toBe("#1");
    expect(formatRankLabel(2)).toBe("#2");
    expect(formatRankLabel(10)).toBe("#10");
  });
});

describe("rankNumClass", () => {
  it("highlights the top 3 ranks with distinct tones", () => {
    expect(rankNumClass(1)).toBe("rank-num rank-num-gold");
    expect(rankNumClass(2)).toBe("rank-num rank-num-silver");
    expect(rankNumClass(3)).toBe("rank-num rank-num-bronze");
  });

  it("falls back to the plain rank style beyond the top 3", () => {
    expect(rankNumClass(4)).toBe("rank-num");
    expect(rankNumClass(100)).toBe("rank-num");
  });
});
