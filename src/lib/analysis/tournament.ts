export type RobustnessParts = {
  crossLotteryConsistency: number;
  longHorizonPerformance: number;
  pairRankingQuality: number;
  standoutPerformance: number;
  downsideProtection: number;
};
export function robustnessScore(parts: RobustnessParts) {
  return (
    0.35 * parts.crossLotteryConsistency +
    0.25 * parts.longHorizonPerformance +
    0.2 * parts.pairRankingQuality +
    0.1 * parts.standoutPerformance +
    0.1 * parts.downsideProtection
  );
}
export function chronologicalSplit<T>(items: T[], developmentShare = 0.75) {
  const holdoutStart = Math.floor(items.length * developmentShare);
  return {
    development: items.slice(0, holdoutStart),
    holdout: items.slice(holdoutStart),
    holdoutStart,
  };
}
export function weightedRate(groups: { hits: number; total: number }[]) {
  const hits = groups.reduce((n, x) => n + x.hits, 0),
    total = groups.reduce((n, x) => n + x.total, 0);
  return { hits, total, rate: total ? hits / total : 0 };
}
export type PromotionMetrics = {
  top1: number;
  top4: number;
  top10: number;
  top20: number;
  meanRank: number;
  worstQuartileTop10: number;
  dispersion: number;
};
export function demonstratesConsistentImprovement(
  candidate: PromotionMetrics,
  balanced: PromotionMetrics,
) {
  return (
    candidate.top1 >= balanced.top1 &&
    candidate.top4 >= balanced.top4 &&
    candidate.top10 > balanced.top10 &&
    candidate.top20 >= balanced.top20 &&
    candidate.meanRank <= balanced.meanRank &&
    candidate.worstQuartileTop10 >= balanced.worstQuartileTop10 &&
    candidate.dispersion <= balanced.dispersion
  );
}
