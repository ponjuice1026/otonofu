export type AlbumCriteriaKey =
  | "lyrics"
  | "musicality"
  | "atmosphere"
  | "innovation";

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
  {
    key: "musicality",
    label: "音楽性",
    formField: "ratingMusicality",
    dbColumn: "rating_musicality",
  },
  {
    key: "atmosphere",
    label: "雰囲気",
    formField: "ratingAtmosphere",
    dbColumn: "rating_atmosphere",
  },
  {
    key: "innovation",
    label: "革新性",
    formField: "ratingInnovation",
    dbColumn: "rating_innovation",
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
    musicality: RATING_UNSET,
    atmosphere: RATING_UNSET,
    innovation: RATING_UNSET,
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
    musicality: base,
    atmosphere: base,
    innovation: base,
  };
}

/** 評価スコアの格付け。8以上=名盤、9以上=歴史に残る超名盤。 */
export type AlbumTier = {
  key: "legendary" | "masterpiece" | "excellent" | "solid" | "mixed" | "none";
  label: string;
  /** バッジ表示に使う色（CSS color） */
  color: string;
};

export function albumTier(rating: number, ratingCount = 1): AlbumTier {
  if (ratingCount <= 0) {
    return { key: "none", label: "評価募集中", color: "#71717a" };
  }
  if (rating >= 9) {
    return { key: "legendary", label: "歴史に残る超名盤", color: "#fbbf24" };
  }
  if (rating >= 8) {
    return { key: "masterpiece", label: "名盤", color: "#f59e0b" };
  }
  if (rating >= 7) {
    return { key: "excellent", label: "傑作", color: "#a3e635" };
  }
  if (rating >= 6) {
    return { key: "solid", label: "良作", color: "#34d399" };
  }
  if (rating >= 4) {
    return { key: "mixed", label: "賛否両論", color: "#60a5fa" };
  }
  return { key: "none", label: "", color: "#71717a" };
}
