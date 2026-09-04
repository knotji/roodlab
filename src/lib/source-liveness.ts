import type { LotteryDraw } from "./types";
import { isCompleteDraw } from "./data-sources/integrity";

export type SourceLivenessStatus = "active-like" | "dormant-like" | "unknown";

const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000;

export function completeDrawGaps(draws: LotteryDraw[]) {
  const dates = [...new Set(draws.filter(isCompleteDraw).map((draw) => draw.drawDate))].sort();
  return dates.slice(1).map((date, index) => dayNumber(date) - dayNumber(dates[index])).filter((gap) => Number.isFinite(gap) && gap >= 0);
}

export function percentileNearestRank(values: number[], percentile: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), index = Math.max(0, Math.ceil(percentile * sorted.length) - 1);
  return sorted[index];
}

export function classifySourceLiveness(input: { ageDays: number; gaps: number[] }): {
  status: SourceLivenessStatus;
  medianGapDays: number | null;
  p90GapDays: number | null;
  ageToP90Ratio: number | null;
} {
  const medianGapDays = percentileNearestRank(input.gaps, 0.5), p90GapDays = percentileNearestRank(input.gaps, 0.9),
    ageToP90Ratio = p90GapDays && p90GapDays > 0 ? input.ageDays / p90GapDays : null;
  let status: SourceLivenessStatus = "unknown";
  if (input.gaps.length >= 10 && ageToP90Ratio !== null) {
    if (ageToP90Ratio <= 2) status = "active-like";
    else if (ageToP90Ratio >= 5) status = "dormant-like";
  }
  return { status, medianGapDays, p90GapDays, ageToP90Ratio };
}

export function ageInDays(targetDate: string, latestDate: string) {
  return dayNumber(targetDate) - dayNumber(latestDate);
}
