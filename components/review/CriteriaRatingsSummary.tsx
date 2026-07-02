import { ALBUM_RATING_CRITERIA, formatRating, ratingColor } from "@/lib/ratings";
import type { AlbumCriteriaRatings } from "@/lib/types";
import { StarRating } from "@/components/ui/StarRating";

type CriteriaRatingsSummaryProps = {
  criteria: AlbumCriteriaRatings;
  average: number;
  compact?: boolean;
  placement?: "default" | "header";
};

export function CriteriaRatingsSummary({
  criteria,
  average,
  compact = false,
  placement = "default",
}: CriteriaRatingsSummaryProps) {
  if (compact && placement === "header") {
    return (
      <div className="review-ratings-header">
        <StarRating value={average} size="sm" />
        <div className="review-ratings-header__criteria">
          {ALBUM_RATING_CRITERIA.map(({ key, label }) => (
            <span key={key} className="review-ratings-header__item">
              <span className="review-ratings-header__label">{label}</span>
              <span
                className="review-ratings-header__value num-stat"
                style={{ color: ratingColor(criteria[key]) }}
              >
                {formatRating(criteria[key])}
              </span>
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="review-ratings-compact">
        <span className="review-ratings-compact__overall">
          <span className="review-ratings-compact__overall-label">総合</span>
          <StarRating value={average} size="md" />
        </span>
        {ALBUM_RATING_CRITERIA.map(({ key, label }) => (
          <span key={key} className="review-ratings-compact__item">
            <span aria-hidden="true" className="review-ratings-compact__sep">
              ·
            </span>
            <span className="review-ratings-compact__label">{label}</span>
            <span
              className="review-ratings-compact__value num-stat"
              style={{ color: ratingColor(criteria[key]) }}
            >
              {formatRating(criteria[key])}
            </span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/50 p-3">
      <div className="mb-3 flex items-center gap-3">
        <span className="text-sm text-zinc-400">総合評価（5項目の平均）</span>
        <StarRating value={average} showBar />
      </div>
      <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full"
          style={{
            width: `${(average / 10) * 100}%`,
            backgroundColor: ratingColor(average),
          }}
        />
      </div>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ALBUM_RATING_CRITERIA.map(({ key, label }) => (
          <div
            key={key}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <dt className="text-zinc-400">{label}</dt>
            <dd
              className="num-stat text-lg"
              style={{ color: ratingColor(criteria[key]) }}
            >
              {formatRating(criteria[key])}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
