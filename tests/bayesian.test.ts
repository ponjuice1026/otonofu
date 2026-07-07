import { describe, expect, it } from "vitest";
import {
  BAYESIAN_PRIOR_WEIGHT,
  bayesianScore,
} from "@/lib/albums/bayesian";

describe("bayesianScore", () => {
  it("評価1件の満点より、評価多数で高評価のアルバムのほうがスコアが高い", () => {
    const globalMean = 6;

    const oneReviewPerfect = bayesianScore({
      ratingCount: 1,
      avgRating: 10,
      globalMean,
    });

    const manyReviewsHigh = bayesianScore({
      ratingCount: 500,
      avgRating: 8.5,
      globalMean,
    });

    expect(manyReviewsHigh).toBeGreaterThan(oneReviewPerfect);
  });

  it("v(評価数) → ∞ で R(そのアルバムの平均)に収束する", () => {
    const globalMean = 5;
    const avgRating = 9;

    const score = bayesianScore({
      ratingCount: 1_000_000,
      avgRating,
      globalMean,
    });

    expect(score).toBeCloseTo(avgRating, 2);
  });

  it("v = 0 で C(全体平均)に収束する", () => {
    const globalMean = 6.3;

    const score = bayesianScore({
      ratingCount: 0,
      avgRating: 10,
      globalMean,
    });

    expect(score).toBeCloseTo(globalMean, 6);
  });

  it("評価数が増えるほど、そのアルバムの平均に単調に近づく(平均が全体平均より高い場合)", () => {
    const globalMean = 5;
    const avgRating = 9;

    const scores = [0, 1, 5, 20, 100, 1000].map((ratingCount) =>
      bayesianScore({ ratingCount, avgRating, globalMean }),
    );

    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
    }
    expect(scores[scores.length - 1]).toBeLessThanOrEqual(avgRating);
  });

  it("評価数が増えるほど、そのアルバムの平均に単調に近づく(平均が全体平均より低い場合)", () => {
    const globalMean = 7;
    const avgRating = 3;

    const scores = [0, 1, 5, 20, 100, 1000].map((ratingCount) =>
      bayesianScore({ ratingCount, avgRating, globalMean }),
    );

    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
    expect(scores[scores.length - 1]).toBeGreaterThanOrEqual(avgRating);
  });

  it("デフォルトの priorWeight は BAYESIAN_PRIOR_WEIGHT を使う", () => {
    const globalMean = 5;
    const avgRating = 10;
    const ratingCount = 10;

    const withDefault = bayesianScore({ ratingCount, avgRating, globalMean });
    const withExplicit = bayesianScore({
      ratingCount,
      avgRating,
      globalMean,
      priorWeight: BAYESIAN_PRIOR_WEIGHT,
    });

    expect(withDefault).toBe(withExplicit);
    // v = m のとき、score は R と C のちょうど中間になる
    expect(withDefault).toBeCloseTo((avgRating + globalMean) / 2, 6);
  });

  it("priorWeight を大きくするほど全体平均寄りになる(保守的になる)", () => {
    const globalMean = 5;
    const avgRating = 10;
    const ratingCount = 10;

    const smallPrior = bayesianScore({
      ratingCount,
      avgRating,
      globalMean,
      priorWeight: 1,
    });
    const largePrior = bayesianScore({
      ratingCount,
      avgRating,
      globalMean,
      priorWeight: 50,
    });

    expect(largePrior).toBeLessThan(smallPrior);
  });

  it("ratingCount や priorWeight が負の値でも破綻しない(0扱い)", () => {
    const score = bayesianScore({
      ratingCount: -5,
      avgRating: 8,
      globalMean: 5,
      priorWeight: -3,
    });

    expect(Number.isFinite(score)).toBe(true);
  });
});
