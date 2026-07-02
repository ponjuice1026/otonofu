export const RATING_MIN = 0;
export const RATING_MAX = 10;
export const RATING_UNSET = -1;

export function clampRating(value: number, max = RATING_MAX): number {
  return Math.min(max, Math.max(RATING_MIN, value));
}

/** 0=赤 → 10=緑 */
export function ratingColor(value: number, max = RATING_MAX): string {
  const ratio = clampRating(value, max) / max;
  const hue = ratio * 120;
  return `hsl(${hue} 75% 50%)`;
}

export function formatRating(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}
