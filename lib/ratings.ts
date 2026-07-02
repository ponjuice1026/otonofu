export type AlbumCriteriaKey =
  | "lyrics"
  | "melody"
  | "performance"
  | "atmosphere"
  | "completion";

import type { AlbumCriteriaRatings as AlbumCriteriaRatingsType } from "@/lib/types";
import {
  RATING_MAX,
  RATING_MIN,
  RATING_UNSET,
  clampRating,
} from "@/lib/ratings/color";

export type AlbumCriteriaRatings = AlbumCriteriaRatingsType;

export { RATING_MAX, RATING_MIN, RATING_UNSET } from "@/lib/ratings/color";
export { formatRating, ratingColor } from "@/lib/ratings/color";

export const ALBUM_RATING_CRITERIA: {
  key: AlbumCriteriaKey;
  label: string;
  formField: string;
  dbColumn: string;
}[] = [
  { key: "lyrics", label: "歌詞", formField: "ratingLyrics", dbColumn: "rating_lyrics" },
  { key: "melody", label: "メロディ", formField: "ratingMelody", dbColumn: "rating_melody" },
  {
    key: "performance",
    label: "演奏技術",
    formField: "ratingPerformance",
    dbColumn: "rating_performance",
  },
  {
    key: "atmosphere",
    label: "雰囲気",
    formField: "ratingAtmosphere",
    dbColumn: "rating_atmosphere",
  },
  {
    key: "completion",
    label: "完成度",
    formField: "ratingCompletion",
    dbColumn: "rating_completion",
  },
];

export function averageCriteriaRatings(criteria: AlbumCriteriaRatings): number {
  const values = ALBUM_RATING_CRITERIA.map(({ key }) => criteria[key]);
  const sum = values.reduce((total, value) => total + value, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

export function isValidRating(value: number): boolean {
  return value >= RATING_MIN && value <= RATING_MAX;
}

export function isCompleteCriteria(criteria: AlbumCriteriaRatings): boolean {
  return ALBUM_RATING_CRITERIA.every(({ key }) => isValidRating(criteria[key]));
}

export function emptyCriteriaRatings(): AlbumCriteriaRatings {
  return {
    lyrics: RATING_UNSET,
    melody: RATING_UNSET,
    performance: RATING_UNSET,
    atmosphere: RATING_UNSET,
    completion: RATING_UNSET,
  };
}

export function criteriaFromReview(review: {
  criteriaRatings?: AlbumCriteriaRatings;
  rating: number;
}): AlbumCriteriaRatings {
  if (review.criteriaRatings && isCompleteCriteria(review.criteriaRatings)) {
    return review.criteriaRatings;
  }

  const base = clampRating(Math.round(review.rating));
  return {
    lyrics: base,
    melody: base,
    performance: base,
    atmosphere: base,
    completion: base,
  };
}
