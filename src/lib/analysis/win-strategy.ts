import type { LotteryDraw } from "../types";
import type { ConsensusResult } from "./consensus";
import type { DigitSignal } from "./types";

export type DiversifiedWinSix = {
  main: DigitSignal[];
  position: DigitSignal[];
  contrarian: DigitSignal[];
  digits: DigitSignal[];
};

export function buildDiversifiedWinSix(
  digits: DigitSignal[],
  consensus: ConsensusResult | null,
): DiversifiedWinSix {
  const consensusOrder =
      consensus?.digits
        .map((item) => digits.find((digit) => digit.digit === item.digit))
        .filter((digit): digit is DigitSignal => Boolean(digit)) ?? digits,
    main = consensusOrder.slice(0, 3),
    used = new Set(main.map((digit) => digit.digit)),
    remaining = digits.filter((digit) => !used.has(digit.digit)),
    position = [...remaining]
      .sort(
        (a, b) =>
          a.positionRank - b.positionRank || b.score - a.score || a.digit.localeCompare(b.digit),
      )
      .slice(0, 2);

  position.forEach((digit) => used.add(digit.digit));
  const contrarian = digits
    .filter((digit) => !used.has(digit.digit))
    .sort(
      (a, b) =>
        b.momentum - a.momentum || b.recent10 - a.recent10 || a.rank - b.rank,
    )
    .slice(0, 1);

  return { main, position, contrarian, digits: [...main, ...position, ...contrarian] };
}

function combinations(n: number, k: number) {
  if (k < 0 || k > n) return 0;
  let value = 1;
  for (let index = 1; index <= k; index += 1)
    value = (value * (n - k + index)) / index;
  return value;
}

export function historicalWinCoverage(draws: LotteryDraw[], selectedDigits: string[]) {
  const selected = new Set(selectedDigits),
    eligible = draws.filter((draw) => draw.top3 || draw.bottom2),
    hits = eligible.filter((draw) =>
      `${draw.top3 ?? ""}${draw.bottom2 ?? ""}`
        .split("")
        .some((digit) => selected.has(digit)),
    ).length,
    selectionSize = selected.size,
    randomMissRates = eligible.map((draw) => {
      const uniqueOutcomeDigits = new Set(`${draw.top3 ?? ""}${draw.bottom2 ?? ""}`).size;
      return combinations(10 - uniqueOutcomeDigits, selectionSize) / combinations(10, selectionSize);
    }),
    randomBaseline = randomMissRates.length
      ? 1 - randomMissRates.reduce((total, rate) => total + rate, 0) / randomMissRates.length
      : null;

  return {
    hits,
    total: eligible.length,
    rate: eligible.length ? hits / eligible.length : null,
    randomBaseline,
  };
}
