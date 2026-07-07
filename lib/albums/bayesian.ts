/**
 * ベイズ加重平均によるランキングスコア。
 *
 * 単純平均(avg_rating)だけで並べると、評価1件だけの満点アルバムが
 * 評価数十件で高評価のアルバムより上位に来てしまう(RYM型サイトの信頼性を損なう)。
 * IMDb/RYM が使うベイズ推定(値が少ないほど全体平均へ引き寄せる)で補正する。
 *
 *   score = (v * R + m * C) / (v + m)
 *
 *   v = そのアルバムの評価数 (ratingCount)
 *   R = そのアルバムの平均評価 (avgRating)
 *   C = 全アルバムの平均評価 (globalMean)
 *   m = 事前の重み。「これくらいの評価数があれば信頼できる」の目安 (priorWeight)
 *
 * v → ∞ で R に収束し、v = 0 で C に収束する。
 */

/** 「信頼に足る評価数」の目安。RYM 等を参考にした経験的なデフォルト値。 */
export const BAYESIAN_PRIOR_WEIGHT = 10;

export type BayesianScoreInput = {
  /** そのアルバムの評価数 */
  ratingCount: number;
  /** そのアルバムの平均評価 */
  avgRating: number;
  /** 全体の平均評価 */
  globalMean: number;
  /** 事前の重み(デフォルト BAYESIAN_PRIOR_WEIGHT) */
  priorWeight?: number;
};

export function bayesianScore({
  ratingCount,
  avgRating,
  globalMean,
  priorWeight = BAYESIAN_PRIOR_WEIGHT,
}: BayesianScoreInput): number {
  const v = Math.max(0, ratingCount);
  const m = Math.max(0, priorWeight);

  if (v + m <= 0) return 0;

  return (v * avgRating + m * globalMean) / (v + m);
}
