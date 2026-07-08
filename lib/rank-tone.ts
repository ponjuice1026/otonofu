export function rankNumClass(rank: number): string {
  if (rank === 1) return "rank-num rank-num-gold";
  if (rank === 2) return "rank-num rank-num-silver";
  if (rank === 3) return "rank-num rank-num-bronze";
  return "rank-num";
}

/**
 * 表示用の順位ラベルを返す（例: 1 -> "#1"）。
 * 「この数字は何?」という混乱を避けるため、単なる数字ではなく順位だと分かる表記にする。
 */
export function formatRankLabel(rank: number): string {
  return `#${rank}`;
}
