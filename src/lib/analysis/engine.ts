import type { LotteryDraw } from "../types";
import { getAlgorithm } from "./algorithms";
import type {
  AnalysisResult,
  DigitSignal,
  DigitWeights,
  PairSignal,
  PairWeights,
  Side,
} from "./types";
const clamp = (n: number) => Math.max(0, Math.min(100, n));
const round = (n: number) => Math.round(n * 10) / 10;
const fields = (draw: LotteryDraw, side: Side) =>
  side === "top"
    ? ([draw.top3].filter(Boolean) as string[])
    : ([draw.bottom2].filter(Boolean) as string[]);
export function countDigit(
  draws: LotteryDraw[],
  digit: string,
  side: Side,
  limit = draws.length,
) {
  return draws.slice(0, limit).reduce(
    (n, d) =>
      n +
      fields(d, side)
        .join("")
        .split("")
        .filter((x) => x === digit).length,
    0,
  );
}
export function positionFrequency(
  draws: LotteryDraw[],
  side: Side,
  digit: string,
) {
  const result: Record<string, number> = { hundreds: 0, tens: 0, units: 0 };
  for (const d of draws) {
    const value = side === "top" ? d.top3 : d.bottom2;
    if (!value) continue;
    if (value.length === 3 && value[0] === digit) result.hundreds++;
    if (value.at(-2) === digit) result.tens++;
    if (value.at(-1) === digit) result.units++;
  }
  return result;
}
export function positionMatrix(
  draws: LotteryDraw[],
  side: Side,
): { digit: string; hundreds: number; tens: number; units: number }[] {
  return Array.from({ length: 10 }, (_, i) => {
    const digit = String(i),
      p = positionFrequency(draws, side, digit);
    return { digit, hundreds: p.hundreds, tens: p.tens, units: p.units };
  });
}
export function gapStats(draws: LotteryDraw[], digit: string, side: Side) {
  const hits = draws.map((d) => fields(d, side).join("").includes(digit));
  const first = hits.indexOf(true),
    gap = first < 0 ? null : first,
    intervals: number[] = [];
  let previous = -1;
  hits.forEach((hit, i) => {
    if (hit) {
      if (previous >= 0) intervals.push(i - previous - 1);
      previous = i;
    }
  });
  return {
    gap,
    averageGap: intervals.length
      ? round(intervals.reduce((a, b) => a + b, 0) / intervals.length)
      : null,
    longestGap: intervals.length ? Math.max(...intervals) : null,
  };
}
export function momentum(draws: LotteryDraw[], digit: string, side: Side) {
  const recent = countDigit(draws, digit, side, 10),
    previous = countDigit(draws.slice(10), digit, side, 10),
    value = recent - previous;
  return {
    recent,
    previous,
    value,
    trend:
      value >= 2
        ? ("กำลังขึ้น" as const)
        : value <= -2
          ? ("กำลังลด" as const)
          : ("ทรงตัว" as const),
  };
}
const normalize = (values: number[]) => {
  const max = Math.max(...values, 1);
  return values.map((v) => clamp((v / max) * 100));
};
function analyzeDigits(
  draws: LotteryDraw[],
  side: Side,
  weights: DigitWeights,
) {
  const raw = Array.from({ length: 10 }, (_, i) => {
      const digit = String(i),
        mom = momentum(draws, digit, side),
        positions = positionFrequency(draws, side, digit);
      return {
        digit,
        frequency: countDigit(draws, digit, side),
        mom,
        positions,
        gap: gapStats(draws, digit, side),
      };
    }),
    freqN = normalize(raw.map((x) => x.frequency)),
    recentN = normalize(raw.map((x) => x.mom.recent)),
    posN = normalize(raw.map((x) => Math.max(...Object.values(x.positions))));
  const signals = raw.map((x, i) => {
    const components = {
        frequency: round(freqN[i]),
        recentFrequency: round(recentN[i]),
        momentum: round(clamp(50 + x.mom.value * 12.5)),
        positionStrength: round(posN[i]),
        gapPattern: round(x.gap.gap === null ? 0 : clamp(100 - x.gap.gap * 12)),
      },
      score = round(
        Object.entries(weights).reduce(
          (sum, [key, weight]) =>
            sum + components[key as keyof typeof components] * weight,
          0,
        ),
      ),
      best = Object.entries(x.positions).sort((a, b) => b[1] - a[1])[0][0],
      strongestPosition =
        best === "hundreds"
          ? "หลักร้อย"
          : best === "tens"
            ? "หลักสิบ"
            : "หลักหน่วย";
    return {
      digit: x.digit,
      score,
      rank: 0,
      frequencyRank: 0,
      positionRank: 0,
      components,
      counts: {
        10: x.mom.recent,
        20: countDigit(draws, x.digit, side, 20),
        30: countDigit(draws, x.digit, side, 30),
        50: countDigit(draws, x.digit, side, 50),
        100: countDigit(draws, x.digit, side, 100),
      },
      recent10: x.mom.recent,
      previous10: x.mom.previous,
      trend: x.mom.trend,
      momentum: x.mom.value,
      ...x.gap,
      strongestPosition,
      pairSupport: 0,
      reasons: [],
    } satisfies DigitSignal;
  });
  const frequencyOrder = [...signals].sort(
      (a, b) => b.counts[30] - a.counts[30] || a.digit.localeCompare(b.digit),
    ),
    positionOrder = [...signals].sort(
      (a, b) =>
        b.components.positionStrength - a.components.positionStrength ||
        a.digit.localeCompare(b.digit),
    );
  return signals
    .sort((a, b) => b.score - a.score || a.digit.localeCompare(b.digit))
    .map((s, i) => ({
      ...s,
      rank: i + 1,
      frequencyRank: frequencyOrder.findIndex((x) => x.digit === s.digit) + 1,
      positionRank: positionOrder.findIndex((x) => x.digit === s.digit) + 1,
    }));
}
export function pairFrequency(
  draws: LotteryDraw[],
  pair: string,
  side: Side,
  limit = draws.length,
) {
  return draws
    .slice(0, limit)
    .filter((d) => (side === "top" ? d.top2 : d.bottom2) === pair).length;
}
function scorePairs(
  draws: LotteryDraw[],
  side: Side,
  digits: DigitSignal[],
  includeDoubles: boolean,
  weights: PairWeights,
) {
  if (!draws.some((d) => (side === "top" ? d.top2 : d.bottom2))) return [];
  const map = new Map(digits.map((d) => [d.digit, d])),
    pairs = Array.from({ length: 100 }, (_, i) =>
      String(i).padStart(2, "0"),
    ).filter((p) => includeDoubles || p[0] !== p[1]),
    maxFreq = Math.max(1, ...pairs.map((p) => pairFrequency(draws, p, side))),
    maxRecent = Math.max(
      1,
      ...pairs.map((p) => pairFrequency(draws, p, side, 10)),
    );
  return pairs
    .map((pair) => {
      const a = map.get(pair[0])!,
        b = map.get(pair[1])!,
        freq = pairFrequency(draws, pair, side),
        recent = pairFrequency(draws, pair, side, 10),
        components = {
          digitA: a.score,
          digitB: b.score,
          pairFrequency: round((freq / maxFreq) * 100),
          recentPairTrend: round((recent / maxRecent) * 100),
          positionMatch: round(
            (a.components.positionStrength + b.components.positionStrength) / 2,
          ),
        },
        score = round(
          Object.entries(weights).reduce(
            (sum, [key, weight]) =>
              sum + components[key as keyof typeof components] * weight,
            0,
          ),
        );
      return {
        pair,
        score,
        components,
        reasons: [
          `ออกตรง ${freq} ครั้งในช่วงข้อมูล`,
          `เลข ${pair[0]} และ ${pair[1]} มีคะแนน ${a.score} / ${b.score}`,
          `ความสอดคล้องตำแหน่ง ${components.positionMatch}`,
        ],
      } satisfies PairSignal;
    })
    .sort((a, b) => b.score - a.score || a.pair.localeCompare(b.pair));
}
export function rankAllPairs(
  history: LotteryDraw[],
  side: Side,
  algorithmId: string,
  customWeights?: { digitWeights: DigitWeights; pairWeights: PairWeights },
  window = 30,
  includeDoubles = true,
) {
  const draws = [...history]
      .sort((a, b) => b.drawDate.localeCompare(a.drawDate))
      .slice(0, window),
    algorithm = getAlgorithm(algorithmId, customWeights),
    digits = analyzeDigits(draws, side, algorithm.digitWeights);
  return scorePairs(draws, side, digits, includeDoubles, algorithm.pairWeights);
}
export function allocateUniqueTopBottomCandidates(
  top: PairSignal[],
  bottom: PairSignal[],
  count: number,
) {
  const t: PairSignal[] = [],
    b: PairSignal[] = [];
  let ti = 0,
    bi = 0;
  while (t.length < count || b.length < count) {
    if (t.length < count) {
      while (top[ti] && b.some((x) => x.pair === top[ti].pair)) ti++;
      if (top[ti]) t.push(top[ti++]);
    }
    if (b.length < count) {
      while (bottom[bi] && t.some((x) => x.pair === bottom[bi].pair)) bi++;
      if (bottom[bi]) b.push(bottom[bi++]);
    }
    if (ti >= top.length && bi >= bottom.length) break;
  }
  return { top: t, bottom: b };
}
function addReasons(
  digits: DigitSignal[],
  pairs: PairSignal[],
  side: Side,
) {
  return digits.map((d) => {
    const deltaPct = d.previous10
        ? Math.round((d.momentum / d.previous10) * 100)
        : d.recent10
          ? 100
          : 0,
      pairSupport = pairs.filter(
        (p) => p.pair.includes(d.digit) && p.score >= 70,
      ).length,
      sideLabel = side === "top" ? "ฝั่งบน" : "ฝั่งล่าง",
      candidates = [
        {
          strength: 110 - d.frequencyRank,
          text: `${sideLabel} · ${d.counts[30]} ครั้ง / 30 งวด · อันดับ #${d.frequencyRank} ด้านความถี่`,
        },
        {
          strength: Math.abs(deltaPct) + 15,
          text: `${sideLabel} · 10 งวดล่าสุด ${d.recent10} ครั้ง เทียบก่อนหน้า ${d.previous10} ครั้ง · ${deltaPct >= 0 ? "+" : ""}${deltaPct}%`,
        },
        {
          strength: 105 - d.positionRank,
          text: `${sideLabel} · เด่นที่สุดที่${d.strongestPosition} · อันดับ #${d.positionRank} ในสัญญาณตำแหน่ง`,
        },
        {
          strength: d.gap === null ? 0 : 35,
          text: `${sideLabel} · ล่าสุด ${d.gap} งวดก่อน · ช่วงห่างเฉลี่ย ${d.averageGap ?? "--"} งวด`,
        },
        {
          strength: pairSupport * 12,
          text: `${sideLabel} · สนับสนุนคู่คะแนนสูง ${pairSupport} คู่`,
        },
      ];
    const reasons = candidates
      .sort((a, b) => b.strength - a.strength)
      .filter(
        (x, i, a) =>
          x.strength > 0 && (i === 0 || !sameFamily(x.text, a[0].text)),
      )
      .slice(0, 2)
      .map((x) => x.text);
    return { ...d, pairSupport, reasons };
  });
}
const sameFamily = (a: string, b: string) =>
  (a.includes("งวดล่าสุด") && b.includes("งวดล่าสุด")) ||
  (a.includes("ความถี่") && b.includes("ความถี่"));

function averageNullable(a: number | null, b: number | null) {
  const values = [a, b].filter((value): value is number => value !== null);
  return values.length ? round(values.reduce((total, value) => total + value, 0) / values.length) : null;
}

function minNullable(...values: (number | null)[]) {
  const available = values.filter((value): value is number => value !== null);
  return available.length ? Math.min(...available) : null;
}

function maxNullable(...values: (number | null)[]) {
  const available = values.filter((value): value is number => value !== null);
  return available.length ? Math.max(...available) : null;
}

function combineDigitSignals(topDigits: DigitSignal[], bottomDigits: DigitSignal[]) {
  const combined = Array.from({ length: 10 }, (_, value) => {
    const digit = String(value),
      top = topDigits.find((item) => item.digit === digit)!,
      bottom = bottomDigits.find((item) => item.digit === digit)!,
      momentumValue = top.momentum + bottom.momentum,
      strongestSide = top.components.positionStrength >= bottom.components.positionStrength ? "ฝั่งบน" : "ฝั่งล่าง",
      strongestPosition = strongestSide === "ฝั่งบน" ? top.strongestPosition : bottom.strongestPosition;
    return {
      digit,
      score: round((top.score + bottom.score) / 2),
      rank: 0,
      frequencyRank: 0,
      positionRank: 0,
      components: {
        frequency: round((top.components.frequency + bottom.components.frequency) / 2),
        recentFrequency: round((top.components.recentFrequency + bottom.components.recentFrequency) / 2),
        momentum: round((top.components.momentum + bottom.components.momentum) / 2),
        positionStrength: round((top.components.positionStrength + bottom.components.positionStrength) / 2),
        gapPattern: round((top.components.gapPattern + bottom.components.gapPattern) / 2),
      },
      counts: Object.fromEntries([10, 20, 30, 50, 100].map((window) => [window, top.counts[window] + bottom.counts[window]])),
      recent10: top.recent10 + bottom.recent10,
      previous10: top.previous10 + bottom.previous10,
      trend: momentumValue >= 2 ? "กำลังขึ้น" as const : momentumValue <= -2 ? "กำลังลด" as const : "ทรงตัว" as const,
      momentum: momentumValue,
      gap: minNullable(top.gap, bottom.gap),
      averageGap: averageNullable(top.averageGap, bottom.averageGap),
      longestGap: maxNullable(top.longestGap, bottom.longestGap),
      strongestPosition: `${strongestSide} · ${strongestPosition}`,
      pairSupport: top.pairSupport + bottom.pairSupport,
      reasons: [top.reasons[0], bottom.reasons[0]].filter((reason): reason is string => Boolean(reason)),
    } satisfies DigitSignal;
  }),
    frequencyOrder = [...combined].sort((a, b) => b.counts[30] - a.counts[30] || a.digit.localeCompare(b.digit)),
    positionOrder = [...combined].sort((a, b) => b.components.positionStrength - a.components.positionStrength || a.digit.localeCompare(b.digit));
  return combined
    .sort((a, b) => b.score - a.score || a.digit.localeCompare(b.digit))
    .map((item, index) => ({
      ...item,
      rank: index + 1,
      frequencyRank: frequencyOrder.findIndex((candidate) => candidate.digit === item.digit) + 1,
      positionRank: positionOrder.findIndex((candidate) => candidate.digit === item.digit) + 1,
    }));
}
export function analyzeLottery(
  history: LotteryDraw[],
  options: {
    window?: number;
    candidateCount?: number;
    includeDoubles?: boolean;
    algorithmId?: string;
    customWeights?: { digitWeights: DigitWeights; pairWeights: PairWeights };
  } = {},
): AnalysisResult {
  const window = options.window ?? 30,
    draws = [...history]
      .sort((a, b) => b.drawDate.localeCompare(a.drawDate))
      .slice(0, window),
    algorithm = getAlgorithm(
      options.algorithmId ?? "balanced-v1",
      options.customWeights,
    ),
    topDigits = analyzeDigits(draws, "top", algorithm.digitWeights),
    bottomDigits = analyzeDigits(draws, "bottom", algorithm.digitWeights),
    topRaw = scorePairs(
      draws,
      "top",
      topDigits,
      options.includeDoubles ?? true,
      algorithm.pairWeights,
    ),
    bottomRaw = scorePairs(
      draws,
      "bottom",
      bottomDigits,
      options.includeDoubles ?? true,
      algorithm.pairWeights,
    ),
    allocated = allocateUniqueTopBottomCandidates(
      topRaw,
      bottomRaw,
      options.candidateCount ?? 4,
    ),
    explainedTopDigits = addReasons(topDigits, allocated.top, "top"),
    explainedBottomDigits = addReasons(bottomDigits, allocated.bottom, "bottom"),
    digits = combineDigitSignals(explainedTopDigits, explainedBottomDigits);
  return {
    algorithmId: algorithm.id,
    window,
    sampleSize: draws.length,
    standout: digits.slice(0, 2),
    digits,
    topDigits: explainedTopDigits,
    bottomDigits: explainedBottomDigits,
    topPairs: allocated.top,
    bottomPairs: allocated.bottom,
    history: draws,
  };
}

export const PRODUCTION_ALGORITHM_ID = "balanced-v1" as const;
export function analyzeProductionLottery(
  history: LotteryDraw[],
  options: Omit<
    Parameters<typeof analyzeLottery>[1],
    "algorithmId" | "customWeights"
  > = {},
) {
  return analyzeLottery(history, {
    ...options,
    algorithmId: PRODUCTION_ALGORITHM_ID,
  });
}
