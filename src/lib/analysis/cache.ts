import type { LotteryDraw } from "../types";
import type { DigitWeights, PairWeights } from "./types";
import { analyzeLottery } from "./engine";
import { computeHistoryVersion } from "../history-version";
type Options = {
  window: number;
  candidateCount: number;
  includeDoubles: boolean;
  algorithmId: string;
  customWeights?: { digitWeights: DigitWeights; pairWeights: PairWeights };
};
const cache = new Map<string, ReturnType<typeof analyzeLottery>>();
export function historyVersion(history: LotteryDraw[]) {
  return computeHistoryVersion(history[0]?.lotteryId ?? "unknown", history);
}
export function analysisCacheKey(
  lotteryId: string,
  history: LotteryDraw[],
  options: Options,
) {
  return JSON.stringify({
    lotteryId,
    algorithmId: options.algorithmId,
    analysisWindow: options.window,
    candidateCount: options.candidateCount,
    includeDoubles: options.includeDoubles,
    historyVersion: historyVersion(history),
    customWeights: options.customWeights,
  });
}
export function memoizedAnalyze(
  lotteryId: string,
  history: LotteryDraw[],
  options: Options,
) {
  const key = analysisCacheKey(lotteryId, history, options),
    existing = cache.get(key);
  if (existing) return existing;
  const result = analyzeLottery(history, options);
  cache.set(key, result);
  if (cache.size > 100) cache.delete(cache.keys().next().value!);
  return result;
}
export function memoizedProductionAnalyze(
  lotteryId: string,
  history: LotteryDraw[],
  options: Omit<Options, "algorithmId" | "customWeights">,
) {
  return memoizedAnalyze(lotteryId, history, {
    ...options,
    algorithmId: "balanced-v1",
  });
}
export function clearAnalysisCache() {
  cache.clear();
}
