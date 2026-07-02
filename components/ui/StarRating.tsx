import {
  RATING_MAX,
  formatRating,
  ratingColor,
} from "@/lib/ratings/color";

type StarRatingProps = {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  showBar?: boolean;
};

export function StarRating({
  value,
  max = RATING_MAX,
  size = "md",
  showBar = false,
}: StarRatingProps) {
  const textSize =
    size === "sm" ? "text-lg" : size === "lg" ? "text-3xl" : "text-xl";
  const color = ratingColor(value, max);

  return (
    <span className="inline-flex flex-col gap-1">
      <span
        className={`font-mono font-semibold tabular-nums ${textSize}`}
        style={{ color }}
        aria-label={`評価 ${formatRating(value)} / ${max}`}
      >
        {formatRating(value)}
      </span>
      {showBar && (
        <span className="block h-1.5 w-20 overflow-hidden rounded-full bg-zinc-800">
          <span
            className="block h-full rounded-full"
            style={{
              width: `${(value / max) * 100}%`,
              backgroundColor: color,
            }}
          />
        </span>
      )}
    </span>
  );
}
