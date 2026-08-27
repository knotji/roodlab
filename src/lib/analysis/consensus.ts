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
};

function rankForWindow(history: LotteryDraw[], options: ConsensusOptions) {
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
  const current = rankForWindow(history, options),
    eligibleWindows = STABILITY_WINDOWS.filter(
      (window) => history.length >= window,
    ),
    windowTopDigits = eligibleWindows.map(
      (window) =>
        new Set(
          rankForWindow(history, { ...options, window })
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
