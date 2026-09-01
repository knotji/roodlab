import type { LotteryDraw } from "../types";
import { dayPatternLabel, drawWeekday, type DayPattern } from "./day-pattern";

export const GLOBAL_WEEKDAY_LOOKBACK = 12;

export type GlobalWeekdayWinDigit = {
  digit: string;
  score: number;
  topRate: number;
  bottomRate: number;
};

export type GlobalWeekdayWinResult = {
  weekday: Exclude<DayPattern, "all">;
  weekdayLabel: string;
  digits: GlobalWeekdayWinDigit[];
  rankedDigits: GlobalWeekdayWinDigit[];
  lotteryCount: number;
  topLotteryCount: number;
  bottomLotteryCount: number;
  topDrawCount: number;
  bottomDrawCount: number;
  lookbackPerLottery: number;
  cutoffDate: string;
  sufficient: boolean;
};

type GlobalWinSource = { lotteryId: string; draws: LotteryDraw[] };

function sideRates(draws: LotteryDraw[], side: "top2" | "bottom2") {
  const eligible = draws.filter((draw) => draw[side]);
  if (!eligible.length) return null;
  return Object.fromEntries(
    Array.from({ length: 10 }, (_, digit) => {
      const value = String(digit), hits = eligible.filter((draw) => draw[side]?.includes(value)).length;
      return [value, hits / eligible.length];
    }),
  ) as Record<string, number>;
}

export function buildGlobalWeekdayWin(
  sources: GlobalWinSource[],
  options: { weekday: Exclude<DayPattern, "all">; cutoffDate: string; lookbackPerLottery?: number },
): GlobalWeekdayWinResult {
  const lookbackPerLottery = options.lookbackPerLottery ?? GLOBAL_WEEKDAY_LOOKBACK,
    perLottery = sources.map((source) => {
      const draws = source.draws
        .filter((draw) => draw.drawDate < options.cutoffDate && drawWeekday(draw.drawDate) === options.weekday)
        .sort((a, b) => b.drawDate.localeCompare(a.drawDate))
        .slice(0, lookbackPerLottery);
      return { draws, top: sideRates(draws, "top2"), bottom: sideRates(draws, "bottom2") };
    }).filter((source) => source.top || source.bottom),
    topSources = perLottery.filter((source) => source.top),
    bottomSources = perLottery.filter((source) => source.bottom),
    average = (digit: string, side: "top" | "bottom", eligible: typeof perLottery) =>
      eligible.length
        ? eligible.reduce((total, source) => total + (source[side]?.[digit] ?? 0), 0) / eligible.length
        : 0,
    ranked = Array.from({ length: 10 }, (_, value) => {
      const digit = String(value),
        topRate = average(digit, "top", topSources),
        bottomRate = average(digit, "bottom", bottomSources),
        availableSides = Number(topSources.length > 0) + Number(bottomSources.length > 0),
        score = availableSides ? (topRate + bottomRate) / availableSides : 0;
      return { digit, score, topRate, bottomRate };
    }).sort((a, b) => b.score - a.score || b.topRate + b.bottomRate - (a.topRate + a.bottomRate) || a.digit.localeCompare(b.digit));

  return {
    weekday: options.weekday,
    weekdayLabel: dayPatternLabel(options.weekday),
    digits: ranked.slice(0, 6),
    rankedDigits: ranked,
    lotteryCount: perLottery.length,
    topLotteryCount: topSources.length,
    bottomLotteryCount: bottomSources.length,
    topDrawCount: topSources.reduce((total, source) => total + source.draws.filter((draw) => draw.top2).length, 0),
    bottomDrawCount: bottomSources.reduce((total, source) => total + source.draws.filter((draw) => draw.bottom2).length, 0),
    lookbackPerLottery,
    cutoffDate: options.cutoffDate,
    sufficient: perLottery.length >= 10 && topSources.length >= 5 && bottomSources.length >= 5,
  };
}
