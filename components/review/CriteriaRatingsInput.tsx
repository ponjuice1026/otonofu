"use client";

import {
  ALBUM_RATING_CRITERIA,
  RATING_MAX,
  averageCriteriaRatings,
  formatRating,
  isCompleteCriteria,
  ratingColor,
} from "@/lib/ratings";
import type { AlbumCriteriaRatings } from "@/lib/types";
import { RatingSlider } from "@/components/ui/RatingSlider";
import { StarRating } from "@/components/ui/StarRating";

type CriteriaRatingsInputProps = {
  value: AlbumCriteriaRatings;
  onChange: (value: AlbumCriteriaRatings) => void;
  disabled?: boolean;
};

export function CriteriaRatingsInput({
  value,
  onChange,
  disabled = false,
}: CriteriaRatingsInputProps) {
  const complete = isCompleteCriteria(value);
  const average = complete ? averageCriteriaRatings(value) : 0;

  return (
    <div className="flex flex-col gap-4">
      {ALBUM_RATING_CRITERIA.map(({ key, label, formField }) => (
        <div
          key={key}
          className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="text-sm text-zinc-400 sm:w-24">{label}</span>
          <RatingSlider
            name={formField}
            value={value[key]}
            onChange={(score) => onChange({ ...value, [key]: score })}
            disabled={disabled}
            className="w-full sm:max-w-xs"
          />
        </div>
      ))}

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-sm text-zinc-400">総合（4項目の平均）</span>
          {complete ? (
            <StarRating value={average} size="lg" />
          ) : (
            <span className="text-sm text-zinc-500">4項目すべて評価してください</span>
          )}
        </div>
        {complete && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(average / RATING_MAX) * 100}%`,
                backgroundColor: ratingColor(average),
              }}
            />
          </div>
        )}
        {complete && (
          <p className="mt-2 text-xs text-zinc-500">
            0（低評価）→ 赤　/　10（高評価）→ 緑　·　現在{" "}
            <span style={{ color: ratingColor(average) }}>
              {formatRating(average)}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
