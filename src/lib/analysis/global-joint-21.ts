import { drawWeekday, type DayPattern } from "./day-pattern";
import { GLOBAL_WEEKDAY_LOOKBACK } from "./global-weekday-win";
import type { LotteryDraw } from "../types";

export type CanonicalPair = string;
export type Joint21Source = { lotteryId: string; draws: LotteryDraw[] };
export type JointEvent = { topPair: string; bottomPair: string };
export type Joint21Metrics = {
  bothHitRate: number;
  topHitRate: number;
  bottomHitRate: number;
  topOnlyRate: number;
  bottomOnlyRate: number;
  missRate: number;
  sourceCoverage: number;
  totalCoverage: number;
};
export type Joint21Result = Joint21Metrics & {
  selectedPairs: CanonicalPair[];
  selectedDoubles: string[];
  expandedActualCount: number;
};

export const canonicalizeReversePair = (value: string): CanonicalPair =>
  [...value].sort().join("");
export const expandCanonicalPairs = (pairs: readonly string[]) =>
  pairs.flatMap((pair) =>
    pair[0] === pair[1] ? [pair] : [pair, `${pair[1]}${pair[0]}`],
  );
export function classifyJoint21(
  selected: ReadonlySet<string>,
  event: JointEvent,
) {
  const top = selected.has(canonicalizeReversePair(event.topPair)),
    bottom = selected.has(canonicalizeReversePair(event.bottomPair));
  return top && bottom
    ? "both"
    : top
      ? "topOnly"
      : bottom
        ? "bottomOnly"
        : ("miss" as const);
}

export function historicalJointEvents(
  sources: Joint21Source[],
  options: {
    weekday: Exclude<DayPattern, "all">;
    cutoffDate: string;
    lookbackPerLottery?: number;
  },
) {
  const lookback = options.lookbackPerLottery ?? GLOBAL_WEEKDAY_LOOKBACK;
  return sources.flatMap((source) => {
    const events = source.draws
      .filter(
        (draw) =>
          draw.drawDate < options.cutoffDate &&
          drawWeekday(draw.drawDate) === options.weekday &&
          draw.top2 &&
          draw.bottom2,
      )
      .sort((a, b) => b.drawDate.localeCompare(a.drawDate))
      .slice(0, lookback)
      .map((draw) => ({ topPair: draw.top2!, bottomPair: draw.bottom2! }));
    return events.length ? [{ lotteryId: source.lotteryId, events }] : [];
  });
}

export function evaluateJoint21(
  selectedPairs: readonly string[],
  sources: Array<{ lotteryId: string; events: JointEvent[] }>,
): Joint21Metrics {
  const selected = new Set(selectedPairs),
    perSource = sources
      .filter((s) => s.events.length)
      .map((source) => {
        let both = 0,
          topOnly = 0,
          bottomOnly = 0,
          miss = 0;
        for (const event of source.events) {
          const c = classifyJoint21(selected, event);
          if (c === "both") both++;
          else if (c === "topOnly") topOnly++;
          else if (c === "bottomOnly") bottomOnly++;
          else miss++;
        }
        const n = source.events.length;
        return {
          both: both / n,
          top: (both + topOnly) / n,
          bottom: (both + bottomOnly) / n,
          topOnly: topOnly / n,
          bottomOnly: bottomOnly / n,
          miss: miss / n,
          covered: both + topOnly + bottomOnly > 0 ? 1 : 0,
        };
      }),
    mean = (key: keyof (typeof perSource)[number]) =>
      perSource.length
        ? perSource.reduce((s, v) => s + v[key], 0) / perSource.length
        : 0;
  const top = mean("top"),
    bottom = mean("bottom");
  return {
    bothHitRate: mean("both"),
    topHitRate: top,
    bottomHitRate: bottom,
    topOnlyRate: mean("topOnly"),
    bottomOnlyRate: mean("bottomOnly"),
    missRate: mean("miss"),
    sourceCoverage: mean("covered"),
    totalCoverage: (top + bottom) / 2,
  };
}

const candidates = Array.from({ length: 10 }, (_, a) =>
  Array.from({ length: 10 - a }, (_, d) => `${a}${a + d}`),
).flat();
const tuple = (m: Joint21Metrics, pair: string) =>
  [
    m.bothHitRate,
    Math.min(m.topHitRate, m.bottomHitRate),
    m.sourceCoverage,
    m.totalCoverage,
    -Number(pair),
  ] as const;
const better = (a: readonly number[], b: readonly number[]) =>
  a.some(
    (v, i) =>
      v !== b[i] && v > b[i] && a.slice(0, i).every((x, j) => x === b[j]),
  );
export function buildJoint21(
  sources: Joint21Source[],
  options: {
    weekday: Exclude<DayPattern, "all">;
    cutoffDate: string;
    lookbackPerLottery?: number;
  },
): Joint21Result {
  const events = historicalJointEvents(sources, options),
    selected: string[] = [];
  while (selected.length < 21) {
    let choice = "",
      best: readonly number[] | null = null;
    for (const pair of candidates) {
      if (selected.includes(pair)) continue;
      const score = tuple(evaluateJoint21([...selected, pair], events), pair);
      if (!best || better(score, best)) {
        best = score;
        choice = pair;
      }
    }
    selected.push(choice);
  }
  return {
    ...evaluateJoint21(selected, events),
    selectedPairs: selected,
    selectedDoubles: selected.filter((p) => p[0] === p[1]).map((p) => p[0]),
    expandedActualCount: expandCanonicalPairs(selected).length,
  };
}
export function buildFrequencyTop21(
  sources: Joint21Source[],
  options: {
    weekday: Exclude<DayPattern, "all">;
    cutoffDate: string;
    lookbackPerLottery?: number;
  },
): Joint21Result {
  const events = historicalJointEvents(sources, options),
    ranked = candidates
      .map((pair) => ({ pair, metrics: evaluateJoint21([pair], events) }))
      .sort(
        (a, b) =>
          b.metrics.totalCoverage - a.metrics.totalCoverage ||
          a.pair.localeCompare(b.pair),
      )
      .slice(0, 21)
      .map((x) => x.pair);
  return {
    ...evaluateJoint21(ranked, events),
    selectedPairs: ranked,
    selectedDoubles: ranked.filter((p) => p[0] === p[1]).map((p) => p[0]),
    expandedActualCount: expandCanonicalPairs(ranked).length,
  };
}
