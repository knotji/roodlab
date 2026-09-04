import type { LotteryDraw } from "../types";
import { drawWeekday, type DayPattern } from "./day-pattern";
import { rankGlobalDigitScores } from "./global-score-distribution";
import { GLOBAL_WEEKDAY_LOOKBACK, type GlobalWeekdayWinDigit } from "./global-weekday-win";
import { digitRecall, pairCovered } from "./global-weekday-evaluation";

const DIGITS = Array.from({ length: 10 }, (_, value) => String(value));

export type RankConsensusSource = { lotteryId: string; draws: LotteryDraw[] };
export type RankBallot = { lotteryId: string; ranking: GlobalWeekdayWinDigit[] };

function sideRates(draws: LotteryDraw[], side: "top2" | "bottom2") {
  const eligible = draws.filter((draw) => draw[side]);
  if (!eligible.length) return null;
  return Object.fromEntries(DIGITS.map((digit) => [digit, eligible.filter((draw) => draw[side]?.includes(digit)).length / eligible.length])) as Record<string, number>;
}

export function rankPoints(rank: number) {
  if (!Number.isInteger(rank) || rank < 1 || rank > 10) throw new Error(`Rank out of range: ${rank}`);
  return 11 - rank;
}

export function buildRankConsensusBallots(
  sources: RankConsensusSource[],
  options: { weekday: Exclude<DayPattern, "all">; cutoffDate: string; lookbackPerLottery?: number },
): RankBallot[] {
  const lookback = options.lookbackPerLottery ?? GLOBAL_WEEKDAY_LOOKBACK;
  return sources.flatMap((source) => {
    const draws = source.draws
      .filter((draw) => draw.drawDate < options.cutoffDate && drawWeekday(draw.drawDate) === options.weekday)
      .sort((a, b) => b.drawDate.localeCompare(a.drawDate))
      .slice(0, lookback),
      top = sideRates(draws, "top2"), bottom = sideRates(draws, "bottom2"),
      availableSides = Number(Boolean(top)) + Number(Boolean(bottom));
    if (!availableSides) return [];
    const ranking = rankGlobalDigitScores(DIGITS.map((digit) => ({
      digit,
      topRate: top?.[digit] ?? 0,
      bottomRate: bottom?.[digit] ?? 0,
      score: ((top?.[digit] ?? 0) + (bottom?.[digit] ?? 0)) / availableSides,
    })));
    return [{ lotteryId: source.lotteryId, ranking }];
  });
}

export function aggregateRankConsensus(ballots: readonly RankBallot[]) {
  if (!ballots.length) return [];
  return rankGlobalDigitScores(DIGITS.map((digit) => {
    const points = ballots.reduce((total, ballot) => total + rankPoints(ballot.ranking.findIndex((item) => item.digit === digit) + 1), 0) / ballots.length;
    return { digit, score: points, topRate: 0, bottomRate: 0 };
  }));
}

export function buildGlobalRankConsensus(
  sources: RankConsensusSource[],
  options: { weekday: Exclude<DayPattern, "all">; cutoffDate: string; lookbackPerLottery?: number },
) {
  const ballots = buildRankConsensusBallots(sources, options), ranking = aggregateRankConsensus(ballots);
  return { ballots, ranking, digits: ranking.slice(0, 6).map((item) => item.digit) };
}

export function evaluateRankConsensusOutcome(selected: readonly string[], top2: string, bottom2: string) {
  const top = pairCovered(selected, top2), bottom = pairCovered(selected, bottom2);
  return { top, bottom, either: top || bottom, both: top && bottom, recall: digitRecall(selected, [top2, bottom2]) };
}

export function classifyRankConsensusPair(production: { either: boolean }, consensus: { either: boolean }) {
  if (production.either && consensus.either) return "both" as const;
  if (production.either) return "productionOnly" as const;
  if (consensus.either) return "consensusOnly" as const;
  return "neither" as const;
}
