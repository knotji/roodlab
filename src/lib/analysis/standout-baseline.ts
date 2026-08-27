import type { LotteryDraw } from "../types";
export const ALL_STANDOUT_PAIRS = Object.freeze(
  Array.from({ length: 10 }, (_, a) =>
    Array.from({ length: 10 - a - 1 }, (__, offset) => `${a}${a + offset + 1}`),
  ).flat(),
);
export type StandoutTarget = {
  digits: string[];
  sourceFields: ("top3" | "bottom2")[];
  uniqueDigitCount: number;
  rawDigits: string;
};
export function standoutTarget(
  draw: Pick<LotteryDraw, "top3" | "bottom2">,
): StandoutTarget {
  const sourceFields: StandoutTarget["sourceFields"] = [],
    parts: string[] = [];
  if (draw.top3) {
    sourceFields.push("top3");
    parts.push(draw.top3);
  }
  if (draw.bottom2) {
    sourceFields.push("bottom2");
    parts.push(draw.bottom2);
  }
  const rawDigits = parts.join(""),
    digits = [...new Set(rawDigits.split(""))].sort();
  return { digits, sourceFields, uniqueDigitCount: digits.length, rawDigits };
}
export function standoutHit(
  standout: readonly string[],
  draw: Pick<LotteryDraw, "top3" | "bottom2">,
) {
  const target = standoutTarget(draw);
  return standout.some((d) => target.digits.includes(d));
}
export function enumeratedRandomHitProbability(
  draw: Pick<LotteryDraw, "top3" | "bottom2">,
) {
  return (
    ALL_STANDOUT_PAIRS.filter((pair) => standoutHit(pair.split(""), draw))
      .length / ALL_STANDOUT_PAIRS.length
  );
}
const choose2 = (n: number) => (n < 2 ? 0 : (n * (n - 1)) / 2);
export function combinatorialRandomHitProbability(
  draw: Pick<LotteryDraw, "top3" | "bottom2">,
) {
  const k = standoutTarget(draw).uniqueDigitCount;
  return 1 - choose2(10 - k) / choose2(10);
}
export type PairedObservation = {
  outcome: 0 | 1;
  expected: number;
  lotteryId?: string;
};
export function pairedUplift(rows: PairedObservation[]) {
  const observedHits = rows.reduce((n, x) => n + x.outcome, 0),
    expectedHits = rows.reduce((n, x) => n + x.expected, 0),
    variance = rows.reduce((n, x) => n + x.expected * (1 - x.expected), 0),
    n = rows.length,
    uplift = n ? (observedHits - expectedHits) / n : 0,
    z = variance ? (observedHits - expectedHits) / Math.sqrt(variance) : 0;
  return {
    n,
    observedHits,
    expectedHits,
    observedRate: n ? observedHits / n : 0,
    baselineRate: n ? expectedHits / n : 0,
    excessHits: observedHits - expectedHits,
    uplift,
    z,
  };
}
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}
export function bootstrapPairedUplift(
  rows: PairedObservation[],
  repetitions = 10000,
  seed = 20260827,
) {
  if (!rows.length) return { low: 0, high: 0 };
  const random = seeded(seed),
    values: number[] = [];
  for (let r = 0; r < repetitions; r++) {
    let sum = 0;
    for (let i = 0; i < rows.length; i++) {
      const x = rows[Math.floor(random() * rows.length)];
      sum += x.outcome - x.expected;
    }
    values.push(sum / rows.length);
  }
  values.sort((a, b) => a - b);
  return {
    low: values[Math.floor(repetitions * 0.025)],
    high: values[Math.floor(repetitions * 0.975)],
  };
}
