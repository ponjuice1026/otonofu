export function rankNumClass(rank: number): string {
  if (rank === 1) return "rank-num rank-num-gold";
  if (rank === 2) return "rank-num rank-num-silver";
  if (rank === 3) return "rank-num rank-num-bronze";
  return "rank-num";
}
