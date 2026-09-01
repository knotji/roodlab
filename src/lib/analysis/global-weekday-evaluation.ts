import type { LotteryDraw } from "../types";
import { drawWeekday, type DayPattern } from "./day-pattern";
import { buildGlobalWeekdayWin } from "./global-weekday-win";

export type GlobalWeekdayMethod = "weekday-frequency" | "weekday-lift" | "all-days-frequency";
export type GlobalWeekdaySource = { lotteryId: string; draws: LotteryDraw[] };
export type RankedGlobalDigit = { digit: string; score: number; weekdayRate: number; allDaysRate: number };

const DIGITS = Array.from({ length: 10 }, (_, digit) => String(digit));

function completeBefore(source: GlobalWeekdaySource, cutoffDate: string) {
  return source.draws
    .filter((draw) => draw.drawDate < cutoffDate && draw.top2 && draw.bottom2)
    .sort((a, b) => b.drawDate.localeCompare(a.drawDate));
}

function presenceRate(draws: LotteryDraw[], digit: string, side: "top2" | "bottom2") {
  return draws.length ? draws.filter((draw) => draw[side]?.includes(digit)).length / draws.length : 0;
}

function combinedRate(draws: LotteryDraw[], digit: string) {
  return (presenceRate(draws, digit, "top2") + presenceRate(draws, digit, "bottom2")) / 2;
}

export function eligibleGlobalWeekdaySources(
  sources: GlobalWeekdaySource[],
  options: { weekday: Exclude<DayPattern, "all">; cutoffDate: string; weekdayLookback?: number; allDaysLookback?: number; minimumWeekdayDraws?: number; minimumAllDaysDraws?: number },
) {
  const weekdayLookback = options.weekdayLookback ?? 12,
    allDaysLookback = options.allDaysLookback ?? 84,
    minimumWeekdayDraws = options.minimumWeekdayDraws ?? 4,
    minimumAllDaysDraws = options.minimumAllDaysDraws ?? 28;
  return sources.map((source) => {
    const complete = completeBefore(source, options.cutoffDate),
      allDays = complete.slice(0, allDaysLookback),
      weekday = complete.filter((draw) => drawWeekday(draw.drawDate) === options.weekday).slice(0, weekdayLookback);
    return { lotteryId: source.lotteryId, draws: source.draws, weekday, allDays };
  }).filter((source) => source.weekday.length >= minimumWeekdayDraws && source.allDays.length >= minimumAllDaysDraws);
}

export function rankGlobalWeekdayMethod(
  sources: GlobalWeekdaySource[],
  method: GlobalWeekdayMethod,
  options: { weekday: Exclude<DayPattern, "all">; cutoffDate: string; weekdayLookback?: number; allDaysLookback?: number; minimumWeekdayDraws?: number; minimumAllDaysDraws?: number },
): RankedGlobalDigit[] {
  const eligible = eligibleGlobalWeekdaySources(sources, options),
    weekdayLookback = options.weekdayLookback ?? 12;
  if (!eligible.length) return [];
  if (method === "weekday-frequency") {
    const result = buildGlobalWeekdayWin(
      eligible.map((source) => ({ lotteryId: source.lotteryId, draws: source.draws })),
      { weekday: options.weekday, cutoffDate: options.cutoffDate, lookbackPerLottery: weekdayLookback },
    );
    return result.rankedDigits.map((item) => ({ digit: item.digit, score: item.score, weekdayRate: item.score, allDaysRate: 0 }));
  }
  return DIGITS.map((digit) => {
    const weekdayRate = eligible.reduce((total, source) => total + combinedRate(source.weekday, digit), 0) / eligible.length,
      allDaysRate = eligible.reduce((total, source) => total + combinedRate(source.allDays, digit), 0) / eligible.length,
      score = method === "weekday-lift" ? weekdayRate - allDaysRate : allDaysRate;
    return { digit, score, weekdayRate, allDaysRate };
  }).sort((a, b) => b.score - a.score || b.weekdayRate - a.weekdayRate || a.digit.localeCompare(b.digit));
}

export function pairCovered(selected: readonly string[], pair: string) {
  const set = new Set(selected);
  return pair.length === 2 && set.has(pair[0]) && set.has(pair[1]);
}

export function digitRecall(selected: readonly string[], pairs: readonly string[]) {
  const set = new Set(selected), digits = pairs.join("").split("");
  return digits.length ? digits.filter((digit) => set.has(digit)).length / digits.length : 0;
}

function combinations(values: string[], size: number, start = 0, selected: string[] = [], output: string[][] = []): string[][] {
  if (selected.length === size) {
    output.push([...selected]);
    return output;
  }
  for (let index = start; index <= values.length - (size - selected.length); index += 1) {
    selected.push(values[index]);
    combinations(values, size, index + 1, selected, output);
    selected.pop();
  }
  return output;
}

export function exactRandomPairCoverage(pair: string, size: number) {
  const sets = combinations(DIGITS, size);
  return sets.filter((selected) => pairCovered(selected, pair)).length / sets.length;
}

export function exactRandomBothCoverage(top2: string, bottom2: string, size: number) {
  const sets = combinations(DIGITS, size);
  return sets.filter((selected) => pairCovered(selected, top2) && pairCovered(selected, bottom2)).length / sets.length;
}
