import type { LotteryDraw } from "../types";
import { drawWeekday, type DayPattern } from "./day-pattern";
import { buildGlobalWeekdayWin } from "./global-weekday-win";

export type GlobalWeekdayMethod = "weekday-frequency" | "weekday-lift" | "all-days-frequency" | "group-weighted-frequency" | "three-block-stability" | "lottery-consensus" | "top-bottom-balance" | "global-4-1-1";
export type GlobalWeekdaySource = { lotteryId: string; draws: LotteryDraw[] };
export type RankedGlobalDigit = { digit: string; score: number; weekdayRate: number; allDaysRate: number };

const DIGITS = Array.from({ length: 10 }, (_, digit) => String(digit));

export function duplicateGroups(sources: GlobalWeekdaySource[], cutoffDate: string, minimumOverlap = 10, threshold = 0.8) {
  const parent = new Map(sources.map((source) => [source.lotteryId, source.lotteryId]));
  const find = (id: string): string => { const value = parent.get(id)!; if (value === id) return id; const root = find(value); parent.set(id, root); return root; };
  const union = (a: string, b: string) => { const left = find(a), right = find(b); if (left !== right) parent.set(right, left); };
  for (let left = 0; left < sources.length; left += 1) for (let right = left + 1; right < sources.length; right += 1) {
    const a = new Map(completeBefore(sources[left], cutoffDate).map((draw) => [draw.drawDate, `${draw.top2}|${draw.bottom2}`])), aligned = completeBefore(sources[right], cutoffDate).filter((draw) => a.has(draw.drawDate));
    if (aligned.length >= minimumOverlap && aligned.filter((draw) => a.get(draw.drawDate) === `${draw.top2}|${draw.bottom2}`).length / aligned.length >= threshold) union(sources[left].lotteryId, sources[right].lotteryId);
  }
  const grouped = new Map<string, string[]>();
  for (const source of sources) { const root = find(source.lotteryId); grouped.set(root, [...(grouped.get(root) ?? []), source.lotteryId]); }
  return [...grouped.values()].map((ids) => ids.sort()).sort((a, b) => a[0].localeCompare(b[0]));
}

function completeBefore(source: GlobalWeekdaySource, cutoffDate: string) {
  return source.draws
    .filter((draw) => draw.drawDate < cutoffDate && draw.top2 && draw.bottom2)
    .sort((a, b) => b.drawDate.localeCompare(a.drawDate));
}

function presenceRate(draws: LotteryDraw[], digit: string, side: "top2" | "bottom2") {
  return draws.length ? draws.filter((draw) => draw[side]?.includes(digit)).length / draws.length : 0;
}

function combinedRate(draws: LotteryDraw[], digit: string) {
  return (presenceRate(draws, digit, "top2") + presenceRate(draws, digit, "bottom2")) / 2;
}

function rankScores(scores: (digit: string) => { score: number; weekdayRate?: number; allDaysRate?: number }) {
  return DIGITS.map((digit) => ({ digit, weekdayRate: 0, allDaysRate: 0, ...scores(digit) }))
    .sort((a, b) => b.score - a.score || b.weekdayRate - a.weekdayRate || a.digit.localeCompare(b.digit));
}

export function composeGlobal411(combined: RankedGlobalDigit[], top: RankedGlobalDigit[], bottom: RankedGlobalDigit[]) {
  const selected = combined.slice(0, 4), used = new Set(selected.map((item) => item.digit)),
    append = (ranking: RankedGlobalDigit[]) => { const item = ranking.find((candidate) => !used.has(candidate.digit)); if (item) { selected.push(item); used.add(item.digit); } };
  append(top);
  append(bottom);
  combined.forEach((item) => { if (!used.has(item.digit)) { selected.push(item); used.add(item.digit); } });
  return selected;
}

export function eligibleGlobalWeekdaySources(
  sources: GlobalWeekdaySource[],
  options: { weekday: Exclude<DayPattern, "all">; cutoffDate: string; weekdayLookback?: number; allDaysLookback?: number; minimumWeekdayDraws?: number; minimumAllDaysDraws?: number },
) {
  const weekdayLookback = options.weekdayLookback ?? 12,
    allDaysLookback = options.allDaysLookback ?? 84,
    minimumWeekdayDraws = options.minimumWeekdayDraws ?? 4,
    minimumAllDaysDraws = options.minimumAllDaysDraws ?? 28;
  return sources.map((source) => {
    const complete = completeBefore(source, options.cutoffDate),
      allDays = complete.slice(0, allDaysLookback),
      weekday = complete.filter((draw) => drawWeekday(draw.drawDate) === options.weekday).slice(0, weekdayLookback);
    return { lotteryId: source.lotteryId, draws: source.draws, weekday, allDays };
  }).filter((source) => source.weekday.length >= minimumWeekdayDraws && source.allDays.length >= minimumAllDaysDraws);
}

export function rankGlobalWeekdayMethod(
  sources: GlobalWeekdaySource[],
  method: GlobalWeekdayMethod,
  options: { weekday: Exclude<DayPattern, "all">; cutoffDate: string; weekdayLookback?: number; allDaysLookback?: number; minimumWeekdayDraws?: number; minimumAllDaysDraws?: number },
): RankedGlobalDigit[] {
  const eligible = eligibleGlobalWeekdaySources(sources, options),
    weekdayLookback = options.weekdayLookback ?? 12;
  if (!eligible.length) return [];
  if (method === "group-weighted-frequency") {
    const groups = duplicateGroups(eligible, options.cutoffDate), byId = new Map(eligible.map((source) => [source.lotteryId, source]));
    return DIGITS.map((digit) => {
      const groupRates = groups.map((ids) => ids.map((id) => byId.get(id)).filter(Boolean).map((source) => combinedRate(source!.weekday, digit))).filter((rates) => rates.length).map((rates) => rates.reduce((a, b) => a + b, 0) / rates.length), score = groupRates.reduce((a, b) => a + b, 0) / groupRates.length;
      return { digit, score, weekdayRate: score, allDaysRate: 0 };
    }).sort((a, b) => b.score - a.score || a.digit.localeCompare(b.digit));
  }
  if (method === "three-block-stability") {
    return rankScores((digit) => {
      const perLottery = eligible.map((source) => {
        const chronological = [...source.weekday].sort((a, b) => a.drawDate.localeCompare(b.drawDate)), blockSize = Math.ceil(chronological.length / 3),
          blocks = [0, 1, 2].map((index) => chronological.slice(index * blockSize, (index + 1) * blockSize)).filter((block) => block.length),
          rates = blocks.map((block) => combinedRate(block, digit));
        return Math.min(...rates);
      });
      const score = perLottery.reduce((total, value) => total + value, 0) / perLottery.length;
      return { score, weekdayRate: score };
    });
  }
  if (method === "lottery-consensus") {
    const votes = new Map(DIGITS.map((digit) => [digit, 0]));
    for (const source of eligible) {
      const local = DIGITS.map((digit) => ({ digit, score: combinedRate(source.weekday, digit) })).sort((a, b) => b.score - a.score || a.digit.localeCompare(b.digit));
      local.slice(0, 6).forEach((item, index) => votes.set(item.digit, votes.get(item.digit)! + (6 - index)));
    }
    return rankScores((digit) => ({ score: votes.get(digit)! / eligible.length, weekdayRate: combinedRate(eligible.flatMap((source) => source.weekday), digit) }));
  }
  if (method === "top-bottom-balance") {
    return rankScores((digit) => {
      const topRate = eligible.reduce((total, source) => total + presenceRate(source.weekday, digit, "top2"), 0) / eligible.length,
        bottomRate = eligible.reduce((total, source) => total + presenceRate(source.weekday, digit, "bottom2"), 0) / eligible.length,
        score = Math.min(topRate, bottomRate) + 0.5 * Math.max(topRate, bottomRate);
      return { score, weekdayRate: (topRate + bottomRate) / 2 };
    });
  }
  if (method === "global-4-1-1") {
    const combined = rankScores((digit) => { const score = eligible.reduce((total, source) => total + combinedRate(source.weekday, digit), 0) / eligible.length; return { score, weekdayRate: score }; }),
      side = (key: "top2" | "bottom2") => rankScores((digit) => { const score = eligible.reduce((total, source) => total + presenceRate(source.weekday, digit, key), 0) / eligible.length; return { score, weekdayRate: score }; });
    return composeGlobal411(combined, side("top2"), side("bottom2"));
  }
  if (method === "weekday-frequency") {
    const result = buildGlobalWeekdayWin(
      eligible.map((source) => ({ lotteryId: source.lotteryId, draws: source.draws })),
      { weekday: options.weekday, cutoffDate: options.cutoffDate, lookbackPerLottery: weekdayLookback },
    );
    return result.rankedDigits.map((item) => ({ digit: item.digit, score: item.score, weekdayRate: item.score, allDaysRate: 0 }));
  }
  return DIGITS.map((digit) => {
    const weekdayRate = eligible.reduce((total, source) => total + combinedRate(source.weekday, digit), 0) / eligible.length,
      allDaysRate = eligible.reduce((total, source) => total + combinedRate(source.allDays, digit), 0) / eligible.length,
      score = method === "weekday-lift" ? weekdayRate - allDaysRate : allDaysRate;
    return { digit, score, weekdayRate, allDaysRate };
  }).sort((a, b) => b.score - a.score || b.weekdayRate - a.weekdayRate || a.digit.localeCompare(b.digit));
}

export function pairCovered(selected: readonly string[], pair: string) {
  const set = new Set(selected);
  return pair.length === 2 && set.has(pair[0]) && set.has(pair[1]);
}

export function digitRecall(selected: readonly string[], pairs: readonly string[]) {
  const set = new Set(selected), digits = pairs.join("").split("");
  return digits.length ? digits.filter((digit) => set.has(digit)).length / digits.length : 0;
}

function combinations(values: string[], size: number, start = 0, selected: string[] = [], output: string[][] = []): string[][] {
  if (selected.length === size) {
    output.push([...selected]);
    return output;
  }
  for (let index = start; index <= values.length - (size - selected.length); index += 1) {
    selected.push(values[index]);
    combinations(values, size, index + 1, selected, output);
    selected.pop();
  }
  return output;
}

export function exactRandomPairCoverage(pair: string, size: number) {
  const sets = combinations(DIGITS, size);
  return sets.filter((selected) => pairCovered(selected, pair)).length / sets.length;
}

export function exactRandomBothCoverage(top2: string, bottom2: string, size: number) {
  const sets = combinations(DIGITS, size);
  return sets.filter((selected) => pairCovered(selected, top2) && pairCovered(selected, bottom2)).length / sets.length;
}
