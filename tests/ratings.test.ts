import { describe, it, expect } from "vitest";
import {
  averageCriteriaRatings,
  isValidRating,
  isCompleteCriteria,
  emptyCriteriaRatings,
  criteriaFromReview,
  RATING_UNSET,
} from "@/lib/ratings";
import {
  clampRating,
  formatRating,
  RATING_MIN,
  RATING_MAX,
} from "@/lib/ratings/color";
import type { AlbumCriteriaRatings } from "@/lib/types";

const criteria = (values: number[]): AlbumCriteriaRatings => ({
  lyrics: values[0],
  musicality: values[1],
  atmosphere: values[2],
  innovation: values[3],
});

describe("clampRating", () => {
  it("範囲内はそのまま", () => {
    expect(clampRating(5)).toBe(5);
  });

  it("下限未満はRATING_MINにクランプ", () => {
    expect(clampRating(-3)).toBe(RATING_MIN);
  });

  it("上限超過はRATING_MAXにクランプ", () => {
    expect(clampRating(15)).toBe(RATING_MAX);
  });

  it("上限ちょうどはそのまま", () => {
    expect(clampRating(10)).toBe(10);
  });

  it("カスタムmaxを尊重する", () => {
    expect(clampRating(4, 3)).toBe(3);
  });
});

describe("formatRating", () => {
  it("整数はそのまま文字列化", () => {
    expect(formatRating(7)).toBe("7");
  });

  it("小数は小数第1位まで", () => {
    expect(formatRating(7.25)).toBe("7.3");
  });

  it("0は「0」", () => {
    expect(formatRating(0)).toBe("0");
  });
});

describe("isValidRating", () => {
  it("0は有効", () => {
    expect(isValidRating(0)).toBe(true);
  });

  it("10は有効", () => {
    expect(isValidRating(10)).toBe(true);
  });

  it("RATING_UNSET(-1)は無効", () => {
    expect(isValidRating(RATING_UNSET)).toBe(false);
  });

  it("11は無効", () => {
    expect(isValidRating(11)).toBe(false);
  });
});

describe("averageCriteriaRatings", () => {
  it("全て同値なら平均もその値", () => {
    expect(averageCriteriaRatings(criteria([8, 8, 8, 8]))).toBe(8);
  });

  it("合計28→平均7.0", () => {
    expect(averageCriteriaRatings(criteria([8, 7, 9, 4]))).toBe(7);
  });

  it("小数第1位に丸める（合計31→7.8）", () => {
    expect(averageCriteriaRatings(criteria([8, 8, 8, 7]))).toBe(7.8);
  });

  it("全て0なら0", () => {
    expect(averageCriteriaRatings(criteria([0, 0, 0, 0]))).toBe(0);
  });
});

describe("isCompleteCriteria", () => {
  it("全項目が有効なら完成", () => {
    expect(isCompleteCriteria(criteria([5, 6, 7, 8]))).toBe(true);
  });

  it("1項目でも未設定なら未完成", () => {
    expect(isCompleteCriteria(criteria([5, 6, 7, RATING_UNSET]))).toBe(false);
  });

  it("emptyCriteriaRatingsは未完成", () => {
    expect(isCompleteCriteria(emptyCriteriaRatings())).toBe(false);
  });
});

describe("emptyCriteriaRatings", () => {
  it("全項目がRATING_UNSET", () => {
    expect(emptyCriteriaRatings()).toEqual({
      lyrics: RATING_UNSET,
      musicality: RATING_UNSET,
      atmosphere: RATING_UNSET,
      innovation: RATING_UNSET,
    });
  });
});

describe("criteriaFromReview", () => {
  it("criteriaRatingsが完成していればそれを返す", () => {
    const cr = criteria([1, 2, 3, 4]);
    expect(criteriaFromReview({ criteriaRatings: cr, rating: 9 })).toEqual(cr);
  });

  it("criteriaRatingsが無ければ総合評価を丸めた値で全項目を埋める", () => {
    expect(criteriaFromReview({ rating: 7.4 })).toEqual(criteria([7, 7, 7, 7]));
  });

  it("criteriaRatingsが未完成ならフォールバックする", () => {
    const incomplete = criteria([1, 2, 3, RATING_UNSET]);
    expect(
      criteriaFromReview({ criteriaRatings: incomplete, rating: 6 }),
    ).toEqual(criteria([6, 6, 6, 6]));
  });

  it("総合評価は0-10にクランプされる", () => {
    expect(criteriaFromReview({ rating: 12 })).toEqual(
      criteria([RATING_MAX, RATING_MAX, RATING_MAX, RATING_MAX]),
    );
  });
});
