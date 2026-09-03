import type { LotteryDraw } from "../types";
import { dayPatternLabel, drawWeekday, type DayPattern } from "./day-pattern";
import { analyzeGlobalScoreDistribution, rankGlobalDigitScores, type GlobalScoreDistribution } from "./global-score-distribution";

export const GLOBAL_WEEKDAY_LOOKBACK = 12;

export type GlobalWeekdayWinDigit = {
  digit: string;
  score: number;
  topRate: number;
  bottomRate: number;
};

export type GlobalWeekdayFrequentPair = {
  pair: string;
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
  sourcePoolCount: number;
  scoreDistribution: GlobalScoreDistribution;
  frequentPairs: GlobalWeekdayFrequentPair[];
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

function pairRates(draws: LotteryDraw[], side: "top2" | "bottom2") {
  const eligible = draws.filter((draw) => draw[side]);
  if (!eligible.length) return null;
  return Object.fromEntries(
    Array.from({ length: 100 }, (_, value) => {
      const pair = String(value).padStart(2, "0"), hits = eligible.filter((draw) => draw[side] === pair).length;
      return [pair, hits / eligible.length];
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
      return {
        draws,
        top: sideRates(draws, "top2"),
        bottom: sideRates(draws, "bottom2"),
        topPairs: pairRates(draws, "top2"),
        bottomPairs: pairRates(draws, "bottom2"),
      };
    }).filter((source) => source.top || source.bottom),
    topSources = perLottery.filter((source) => source.top),
    bottomSources = perLottery.filter((source) => source.bottom),
    average = (digit: string, side: "top" | "bottom", eligible: typeof perLottery) =>
      eligible.length
        ? eligible.reduce((total, source) => total + (source[side]?.[digit] ?? 0), 0) / eligible.length
        : 0,
    ranked = rankGlobalDigitScores(Array.from({ length: 10 }, (_, value) => {
      const digit = String(value),
        topRate = average(digit, "top", topSources),
        bottomRate = average(digit, "bottom", bottomSources),
        availableSides = Number(topSources.length > 0) + Number(bottomSources.length > 0),
        score = availableSides ? (topRate + bottomRate) / availableSides : 0;
      return { digit, score, topRate, bottomRate };
    })),
    unorderedPairs = Array.from({ length: 10 }, (_, first) =>
      Array.from({ length: 10 - first }, (_, offset) => `${first}${first + offset}`),
    ).flat(),
    frequentPairs = unorderedPairs.map((pair) => {
      const reversed = `${pair[1]}${pair[0]}`,
        sourcePairRate = (source: (typeof perLottery)[number], side: "topPairs" | "bottomPairs") =>
          (source[side]?.[pair] ?? 0) + (reversed === pair ? 0 : (source[side]?.[reversed] ?? 0)),
        topRate = topSources.length ? topSources.reduce((total, source) => total + sourcePairRate(source, "topPairs"), 0) / topSources.length : 0,
        bottomRate = bottomSources.length ? bottomSources.reduce((total, source) => total + sourcePairRate(source, "bottomPairs"), 0) / bottomSources.length : 0,
        availableSides = Number(topSources.length > 0) + Number(bottomSources.length > 0);
      return { pair, topRate, bottomRate, score: availableSides ? (topRate + bottomRate) / availableSides : 0 };
    }).sort((a, b) => b.score - a.score || b.topRate - a.topRate || b.bottomRate - a.bottomRate || a.pair.localeCompare(b.pair)).slice(0, 21);

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
    sourcePoolCount: sources.length,
    scoreDistribution: analyzeGlobalScoreDistribution(ranked),
    frequentPairs,
  };
}
