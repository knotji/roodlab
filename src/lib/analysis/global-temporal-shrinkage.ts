import type { LotteryDraw } from "../types";
import { drawWeekday, type DayPattern } from "./day-pattern";
import type { GlobalWeekdaySource, RankedGlobalDigit } from "./global-weekday-evaluation";

const DIGITS = Array.from({ length: 10 }, (_, digit) => String(digit));

function sidePresence(draw: LotteryDraw, digit: string, side: "top2" | "bottom2") {
  return draw[side]?.includes(digit) ? 1 : 0;
}

function combinedPresence(draw: LotteryDraw, digit: string) {
  const sides = [draw.top2, draw.bottom2].filter(Boolean).length;
  if (!sides) return 0;
  return (sidePresence(draw, digit, "top2") + sidePresence(draw, digit, "bottom2")) / sides;
}

export type TemporalShrinkageOptions = {
  weekday: Exclude<DayPattern, "all">;
  cutoffDate: string;
  halfLife: 2 | 4 | 8 | "flat";
  priorStrength: 2 | 6 | 12;
  weekdayLookback?: number;
  allDaysLookback?: number;
  minimumWeekdayDraws?: number;
  minimumAllDaysDraws?: number;
};

export function rankTemporalShrinkage(sources: GlobalWeekdaySource[], options: TemporalShrinkageOptions): RankedGlobalDigit[] {
  const weekdayLookback = options.weekdayLookback ?? 12,
    allDaysLookback = options.allDaysLookback ?? 84,
    minimumWeekdayDraws = options.minimumWeekdayDraws ?? 4,
    minimumAllDaysDraws = options.minimumAllDaysDraws ?? 28,
    eligible = sources.map((source) => {
      const complete = source.draws.filter((draw) => draw.drawDate < options.cutoffDate && (draw.top2 || draw.bottom2)).sort((a, b) => b.drawDate.localeCompare(a.drawDate)),
        allDays = complete.slice(0, allDaysLookback),
        weekday = complete.filter((draw) => drawWeekday(draw.drawDate) === options.weekday).slice(0, weekdayLookback);
      return { allDays, weekday };
    }).filter((source) => source.weekday.length >= minimumWeekdayDraws && source.allDays.length >= minimumAllDaysDraws);

  if (!eligible.length) return [];
  return DIGITS.map((digit) => {
    const sourceScores = eligible.map((source) => {
      const prior = source.allDays.reduce((sum, draw) => sum + combinedPresence(draw, digit), 0) / source.allDays.length,
        weights = source.weekday.map((_, index) => options.halfLife === "flat" ? 1 : 0.5 ** (index / options.halfLife)),
        weightTotal = weights.reduce((sum, weight) => sum + weight, 0),
        weightedHits = source.weekday.reduce((sum, draw, index) => sum + combinedPresence(draw, digit) * weights[index], 0);
      return (weightedHits + options.priorStrength * prior) / (weightTotal + options.priorStrength);
    });
    const score = sourceScores.reduce((sum, value) => sum + value, 0) / sourceScores.length;
    return { digit, score, weekdayRate: score, allDaysRate: score };
  }).sort((a, b) => b.score - a.score || a.digit.localeCompare(b.digit));
}
