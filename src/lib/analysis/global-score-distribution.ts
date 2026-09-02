export type GlobalScoreInput = {
  digit: string;
  score: number;
  topRate: number;
  bottomRate: number;
};

export type GlobalScoreDistribution = {
  rankedScores: { rank: number; digit: string; score: number }[];
  rank6To7Gap: number;
  top6Spread: number;
  allDigitSpread: number;
  normalizedEntropy: number;
  concentration: number;
};

export function rankGlobalDigitScores<T extends GlobalScoreInput>(scores: readonly T[]) {
  return [...scores].sort(
    (a, b) => b.score - a.score || b.topRate + b.bottomRate - (a.topRate + a.bottomRate) || a.digit.localeCompare(b.digit),
  );
}

export function analyzeGlobalScoreDistribution(scores: readonly GlobalScoreInput[]): GlobalScoreDistribution {
  const ranked = rankGlobalDigitScores(scores), values = ranked.map((item) => Math.max(0, item.score)), total = values.reduce((sum, value) => sum + value, 0),
    normalizedEntropy = total > 0
      ? -values.reduce((sum, value) => value > 0 ? sum + (value / total) * Math.log(value / total) : sum, 0) / Math.log(values.length || 1)
      : 1;
  return {
    rankedScores: ranked.map((item, index) => ({ rank: index + 1, digit: item.digit, score: item.score })),
    rank6To7Gap: ranked.length >= 7 ? Math.max(0, ranked[5].score - ranked[6].score) : 0,
    top6Spread: ranked.length >= 6 ? Math.max(0, ranked[0].score - ranked[5].score) : 0,
    allDigitSpread: ranked.length >= 2 ? Math.max(0, ranked[0].score - ranked.at(-1)!.score) : 0,
    normalizedEntropy: Number.isFinite(normalizedEntropy) ? normalizedEntropy : 1,
    concentration: Number.isFinite(normalizedEntropy) ? 1 - normalizedEntropy : 0,
  };
}

export function formatRankBoundaryGap(gap: number) {
  if (gap === 0) return "คะแนนอันดับ 6 และ 7 เท่ากัน";
  const points = gap * 100;
  return points < 0.01
    ? "อันดับ 6 กับอันดับ 7 ต่างกันน้อยกว่า 0.01 จุด"
    : `อันดับ 6 กับอันดับ 7 ต่างกัน ${points.toFixed(2)} จุด`;
}
