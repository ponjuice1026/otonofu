"use client";

import {
  RATING_MAX,
  RATING_MIN,
  RATING_UNSET,
  formatRating,
  ratingColor,
} from "@/lib/ratings/color";

type RatingSliderProps = {
  name?: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  showBar?: boolean;
  className?: string;
};

export function RatingSlider({
  name,
  value,
  onChange,
  disabled = false,
  showBar = false,
  className = "",
}: RatingSliderProps) {
  const hasValue = value >= RATING_MIN;
  const displayValue = hasValue ? value : 0;
  const color = ratingColor(displayValue);

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-center gap-3">
        {name && (
          <input type="hidden" name={name} value={hasValue ? value : ""} />
        )}
        <input
          type="range"
          min={RATING_MIN}
          max={RATING_MAX}
          step={1}
          value={displayValue}
          onChange={(event) => onChange(Number(event.target.value))}
          disabled={disabled}
          aria-valuemin={RATING_MIN}
          aria-valuemax={RATING_MAX}
          aria-valuenow={hasValue ? value : undefined}
          aria-label="評価"
          className="h-2 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full"
          style={{
            background: `linear-gradient(to right, ${color} 0%, ${color} ${(displayValue / RATING_MAX) * 100}%, rgb(39 39 42) ${(displayValue / RATING_MAX) * 100}%, rgb(39 39 42) 100%)`,
          }}
        />
        <span
          className="w-8 shrink-0 text-right font-mono text-sm font-semibold tabular-nums"
          style={{ color: hasValue ? color : undefined }}
        >
          {hasValue ? formatRating(value) : "—"}
        </span>
      </div>
      {showBar && hasValue && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${(value / RATING_MAX) * 100}%`,
              backgroundColor: color,
            }}
          />
        </div>
      )}
    </div>
  );
}

export { RATING_UNSET };
