import type { LotteryDraw } from "../types";
import { ALGORITHMS } from "./algorithms";
import { analyzeLottery } from "./engine";

const CONSENSUS_TOP_DIGITS = 5;
export const STABILITY_WINDOWS = [10, 20, 30, 50] as const;

export type ConsensusDigit = {
  digit: string;
  votes: number;
  averageRank: number;
  algorithmIds: string[];
  stableWindows: number;
  bestRank: number;
};

export type DistributedConsensus = {
  main: ConsensusDigit[];
  middle: ConsensusDigit[];
  inserts: ConsensusDigit[];
  digits: ConsensusDigit[];
};

export type ConsensusResult = {
  digits: ConsensusDigit[];
  formulaCount: number;
  eligibleWindows: number[];
  stabilityScore: number | null;
  stabilityStatus: "stable" | "mixed" | "unstable" | "insufficient";
};

type ConsensusOptions = {
  window: number;
  candidateCount: number;
  includeDoubles: boolean;
  stabilityWindows?: readonly number[];
};

function rankForWindow(history: LotteryDraw[], options: Omit<ConsensusOptions, "stabilityWindows">) {
  const analyses = ALGORITHMS.map((algorithm) =>
    analyzeLottery(history, { ...options, algorithmId: algorithm.id }),
  );
  return Array.from({ length: 10 }, (_, value) => {
    const digit = String(value),
      agreeing = analyses.filter(
        (analysis) =>
          analysis.digits.findIndex((item) => item.digit === digit) <
          CONSENSUS_TOP_DIGITS,
      ),
      rankTotal = analyses.reduce(
        (total, analysis) =>
          total +
          analysis.digits.findIndex((item) => item.digit === digit) +
          1,
        0,
      );
    return {
      digit,
      votes: agreeing.length,
      averageRank: Math.round((rankTotal / analyses.length) * 10) / 10,
      algorithmIds: agreeing.map((analysis) => analysis.algorithmId),
      bestRank: Math.min(
        ...analyses.map(
          (analysis) =>
            analysis.digits.findIndex((item) => item.digit === digit) + 1,
        ),
      ),
    };
  }).sort(
    (a, b) =>
      b.votes - a.votes ||
      a.averageRank - b.averageRank ||
      a.digit.localeCompare(b.digit),
  );
}

export function buildConsensus(
  history: LotteryDraw[],
  options: ConsensusOptions,
): ConsensusResult {
  const { stabilityWindows = STABILITY_WINDOWS, ...analysisOptions } = options,
    current = rankForWindow(history, analysisOptions),
    eligibleWindows = stabilityWindows.filter(
      (window) => history.length >= window,
    ),
    windowTopDigits = eligibleWindows.map(
      (window) =>
        new Set(
          rankForWindow(history, { ...analysisOptions, window })
            .slice(0, CONSENSUS_TOP_DIGITS)
            .map((item) => item.digit),
        ),
    ),
    digits = current.map((item) => ({
      ...item,
      stableWindows: windowTopDigits.filter((set) => set.has(item.digit)).length,
    })),
    topDigits = digits.slice(0, CONSENSUS_TOP_DIGITS),
    stabilityScore =
      eligibleWindows.length < 2
        ? null
        : Math.round(
            (topDigits.reduce((total, item) => total + item.stableWindows, 0) /
              (CONSENSUS_TOP_DIGITS * eligibleWindows.length)) *
              100,
          ),
    stabilityStatus =
      stabilityScore === null
        ? ("insufficient" as const)
        : stabilityScore >= 75
          ? ("stable" as const)
          : stabilityScore >= 50
            ? ("mixed" as const)
            : ("unstable" as const);
  return {
    digits,
    formulaCount: ALGORITHMS.length,
    eligibleWindows: [...eligibleWindows],
    stabilityScore,
    stabilityStatus,
  };
}

export function buildDistributedConsensus(
  consensus: ConsensusResult,
  insertCount: 1 | 2 = 2,
): DistributedConsensus {
  const main = consensus.digits.slice(0, 2),
    middle = [...consensus.digits.slice(2, 6)]
      .sort(
        (a, b) =>
          b.stableWindows - a.stableWindows ||
          b.votes - a.votes ||
          a.averageRank - b.averageRank,
      )
      .slice(0, 2),
    inserts = [...consensus.digits.slice(6, 10)]
      .sort(
        (a, b) =>
          a.bestRank - b.bestRank ||
          b.votes - a.votes ||
          b.stableWindows - a.stableWindows ||
          a.averageRank - b.averageRank,
      )
      .slice(0, insertCount);
  return { main, middle, inserts, digits: [...main, ...middle, ...inserts] };
}
