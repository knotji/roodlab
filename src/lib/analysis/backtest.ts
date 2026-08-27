import type { LotteryDraw } from "../types";
import type { DigitWeights, PairWeights } from "./types";
import { analyzeLottery } from "./engine";
import { rankPairsForModel, type RankedPair } from "./pair-audit";
import { standoutHit } from "./standout-baseline";
type ActualPairDiagnostic = {
  rank: number;
  components: RankedPair["components"];
} | null;
export type BacktestRow = {
  draw: LotteryDraw;
  algorithmId: string;
  trainingSize: number;
  trainingEnd: string;
  standout: string[];
  top: string[];
  bottom: string[];
  standoutHit: boolean;
  topHit: boolean;
  bottomHit: boolean;
  top1Hit: boolean;
  topActual: ActualPairDiagnostic;
  bottomActual: ActualPairDiagnostic;
};
function diagnostic(
  trainingNewestFirst: LotteryDraw[],
  actual: string | undefined,
  side: "top" | "bottom",
): ActualPairDiagnostic {
  if (!actual) return null;
  const ranked = rankPairsForModel(trainingNewestFirst, side, "current"),
    index = ranked.findIndex((x) => x.pair === actual);
  return index < 0
    ? null
    : { rank: index + 1, components: ranked[index].components };
}
export function backtest(
  history: LotteryDraw[],
  window = 30,
  testDraws = 30,
  candidateCount = 4,
  algorithmId = "balanced-v1",
  customWeights?: { digitWeights: DigitWeights; pairWeights: PairWeights },
) {
  const chronological = [...history].sort((a, b) =>
      a.drawDate.localeCompare(b.drawDate),
    ),
    rows: BacktestRow[] = [];
  for (let i = window; i < chronological.length; i++) {
    const training = chronological.slice(Math.max(0, i - window), i),
      newestFirst = [...training].reverse(),
      actual = chronological[i],
      analysis = analyzeLottery(training, {
        window,
        candidateCount,
        algorithmId,
        customWeights,
      }),
      standout = analysis.standout.map((x) => x.digit),
      top = analysis.topPairs.map((x) => x.pair),
      bottom = analysis.bottomPairs.map((x) => x.pair);
    rows.push({
      draw: actual,
      algorithmId,
      trainingSize: training.length,
      trainingEnd: training.at(-1)!.drawDate,
      standout,
      top,
      bottom,
      standoutHit: standoutHit(standout, actual),
      topHit: !!actual.top2 && top.includes(actual.top2),
      bottomHit: !!actual.bottom2 && bottom.includes(actual.bottom2),
      top1Hit: actual.top2 === top[0],
      topActual: diagnostic(newestFirst, actual.top2, "top"),
      bottomActual: diagnostic(newestFirst, actual.bottom2, "bottom"),
    });
  }
  return rows.slice(-testDraws).reverse();
}
export function wilsonInterval(hits: number, total: number, z = 1.96) {
  if (!total) return { low: 0, high: 0 };
  const p = hits / total,
    den = 1 + (z * z) / total,
    center = (p + (z * z) / (2 * total)) / den,
    margin =
      (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total)) / den;
  return { low: center - margin, high: center + margin };
}
export function metric(
  rows: BacktestRow[],
  key: "standoutHit" | "topHit" | "bottomHit" | "top1Hit",
) {
  const eligible = rows.filter((row) =>
      key === "bottomHit"
        ? Boolean(row.draw.bottom2)
        : key === "topHit" || key === "top1Hit"
          ? Boolean(row.draw.top2)
          : Boolean(row.draw.top3 || row.draw.bottom2),
    ),
    hits = eligible.filter((x) => x[key]).length,
    total = eligible.length;
  return {
    hits,
    total,
    rate: total ? hits / total : 0,
    interval: wilsonInterval(hits, total),
  };
}
export const referenceBaselines = {
  top4: 0.04,
  bottom4: 0.04,
  top1: 0.01,
  standoutAppearance: null,
};
