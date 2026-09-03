import type { GlobalWeekdayWinDigit } from "./global-weekday-win";
import { digitRecall, pairCovered } from "./global-weekday-evaluation";

export const HOT_COLD_STUDY_WIN_SIZE = 6;

export function selectOverallTop6(ranking: readonly GlobalWeekdayWinDigit[]) {
  return ranking.slice(0, HOT_COLD_STUDY_WIN_SIZE).map((item) => item.digit);
}

export function selectHot3Cold3(ranking: readonly GlobalWeekdayWinDigit[]) {
  return [...ranking.slice(0, 3), ...ranking.slice(7, 10)].map((item) => item.digit);
}

export type StrategyOutcome = {
  top: boolean;
  bottom: boolean;
  either: boolean;
  both: boolean;
  recall: number;
};

export function evaluateStrategyOutcome(selected: readonly string[], top2: string, bottom2: string): StrategyOutcome {
  const top = pairCovered(selected, top2), bottom = pairCovered(selected, bottom2);
  return { top, bottom, either: top || bottom, both: top && bottom, recall: digitRecall(selected, [top2, bottom2]) };
}

export function classifyPairedOutcome(overall: StrategyOutcome, hotCold: StrategyOutcome) {
  if (overall.either && hotCold.either) return "both" as const;
  if (overall.either) return "overallOnly" as const;
  if (hotCold.either) return "hotColdOnly" as const;
  return "neither" as const;
}
