import type { GlobalWeekdayWinDigit } from "./global-weekday-win";

export type SideMissClass = "FULL_COVERAGE" | "ONE_OUTSIDE_DIGIT" | "TWO_OUTSIDE_DIGITS";

export type SideMiss = {
  classification: SideMissClass;
  outsideDigits: string[];
  outsideRanks: number[];
  outsidePositions: number[];
};

export function classifySideMiss(selected: readonly string[], pair: string, ranking: readonly GlobalWeekdayWinDigit[]): SideMiss {
  const selectedSet = new Set(selected), outsideDigits = [...new Set(pair.split(""))].filter((digit) => !selectedSet.has(digit)),
    outsideRanks = outsideDigits.map((digit) => ranking.findIndex((item) => item.digit === digit) + 1),
    outsidePositions = outsideRanks.map((rank) => rank - 6);
  const classification: SideMissClass = outsideDigits.length === 0 ? "FULL_COVERAGE" : outsideDigits.length === 1 ? "ONE_OUTSIDE_DIGIT" : "TWO_OUTSIDE_DIGITS";
  return { classification, outsideDigits, outsideRanks, outsidePositions };
}

export function classifyOutcomeMiss(top: SideMiss, bottom: SideMiss) {
  const topFull = top.classification === "FULL_COVERAGE", bottomFull = bottom.classification === "FULL_COVERAGE",
    coverage = topFull && bottomFull ? "bothFull" : topFull ? "topOnlyFull" : bottomFull ? "bottomOnlyFull" : "neitherFull",
    outsideDigits = [...new Set([...top.outsideDigits, ...bottom.outsideDigits])];
  return { coverage, outsideDigits, outsideCount: outsideDigits.length };
}

export function outsideRanking(ranking: readonly GlobalWeekdayWinDigit[]) {
  return ranking.slice(6, 10).map((item, index) => ({ ...item, globalRank: index + 7, outsidePosition: index + 1 }));
}

export function buildOutsideOpportunities(ranking: readonly GlobalWeekdayWinDigit[], pair: string, side: "top" | "bottom") {
  const appeared = new Set(pair.split(""));
  return outsideRanking(ranking).map((item) => ({
    digit: item.digit,
    rank: item.globalRank,
    position: item.outsidePosition,
    appeared: appeared.has(item.digit),
    expected: side === "top" ? item.topRate : item.bottomRate,
  }));
}

export function outsidePositionPair(miss: SideMiss) {
  return miss.outsidePositions.length === 2 ? [...miss.outsidePositions].sort((a, b) => a - b).join("+") : null;
}
