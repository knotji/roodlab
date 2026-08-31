import type { LotteryDraw } from "../types";
import type { ConsensusResult } from "./consensus";
import type { DigitSignal } from "./types";

export type DiversifiedWinSix = {
  main: DigitSignal[];
  position: DigitSignal[];
  contrarian: DigitSignal[];
  digits: DigitSignal[];
};

export type StableWinSix = {
  core: DigitSignal[];
  topComplement: DigitSignal[];
  bottomComplement: DigitSignal[];
  digits: DigitSignal[];
};

export type WinTrackingMode = "tiered" | "core-support" | "distributed" | "diversified" | "stable-411";
export type WinTrackingGate = {
  passed: boolean;
  checks: { label: string; passed: boolean }[];
};

export function evaluateWinTracking(
  mode: WinTrackingMode,
  evidence: {
    stable: boolean;
    consensusMainVotes: number[];
    selectedCoreVotes: number[];
    distributedInsertBestRanks: number[];
    diversifiedMainVotes: number[];
    diversifiedPositionRanks: number[];
    diversifiedMomentum: number | null;
    stableCoreVotes: number[];
    stableCoreWindows: number[];
    stableTopPositionRank: number | null;
    stableBottomPositionRank: number | null;
  },
): WinTrackingGate {
  const stable = { label: "ความนิ่งข้ามช่วงอยู่ระดับค่อนข้างนิ่ง", passed: evidence.stable },
    checks = mode === "tiered"
      ? [
          stable,
          { label: "เลขหลัก 2 ตัวได้เสียงอย่างน้อย 4/5 สูตร", passed: evidence.consensusMainVotes.length === 2 && evidence.consensusMainVotes.every((votes) => votes >= 4) },
        ]
      : mode === "core-support"
        ? [
            stable,
            { label: "เลขแกน 2 ตัวได้เสียงอย่างน้อย 3/5 สูตร", passed: evidence.selectedCoreVotes.length === 2 && evidence.selectedCoreVotes.every((votes) => votes >= 3) },
          ]
        : mode === "distributed"
          ? [
              stable,
              { label: "เลขหลัก 2 ตัวได้เสียงอย่างน้อย 4/5 สูตร", passed: evidence.consensusMainVotes.length === 2 && evidence.consensusMainVotes.every((votes) => votes >= 4) },
              { label: "ตัวแทรกเคยติด Top 5 อย่างน้อยหนึ่งสูตร", passed: evidence.distributedInsertBestRanks.length === 2 && evidence.distributedInsertBestRanks.every((rank) => rank <= 5) },
            ]
          : mode === "diversified"
          ? [
              stable,
              { label: "เลขหลัก 3 ตัวได้เสียงอย่างน้อย 3/5 สูตร", passed: evidence.diversifiedMainVotes.length === 3 && evidence.diversifiedMainVotes.every((votes) => votes >= 3) },
              { label: "เลขตำแหน่ง 2 ตัวอยู่ใน Top 5 ด้านตำแหน่ง", passed: evidence.diversifiedPositionRanks.length === 2 && evidence.diversifiedPositionRanks.every((rank) => rank <= 5) },
              { label: "ตัวสวนมี Momentum เป็นบวก", passed: (evidence.diversifiedMomentum ?? 0) > 0 },
            ]
          : [
              stable,
              { label: "แกน 4 ตัวได้เสียงอย่างน้อย 3/5 สูตร", passed: evidence.stableCoreVotes.length === 4 && evidence.stableCoreVotes.every((votes) => votes >= 3) },
              { label: "แกน 4 ตัวติดชุดอย่างน้อย 2 ช่วง", passed: evidence.stableCoreWindows.length === 4 && evidence.stableCoreWindows.every((windows) => windows >= 2) },
              { label: "ตัวเสริมบนและล่างอยู่ใน Top 5 ด้านตำแหน่ง", passed: (evidence.stableTopPositionRank ?? 99) <= 5 && (evidence.stableBottomPositionRank ?? 99) <= 5 },
            ];
  return { passed: checks.every((check) => check.passed), checks };
}

export function buildStableWinSix(
  digits: DigitSignal[],
  topDigits: DigitSignal[],
  bottomDigits: DigitSignal[],
  consensus: ConsensusResult | null,
): StableWinSix {
  const byDigit = new Map(digits.map((digit) => [digit.digit, digit])),
    consensusCore = [...(consensus?.digits ?? [])]
      .sort(
        (a, b) =>
          b.stableWindows - a.stableWindows ||
          b.votes - a.votes ||
          a.averageRank - b.averageRank ||
          a.digit.localeCompare(b.digit),
      )
      .map((item) => byDigit.get(item.digit))
      .filter((digit): digit is DigitSignal => Boolean(digit)),
    core = (consensusCore.length ? consensusCore : digits).slice(0, 4),
    used = new Set(core.map((digit) => digit.digit)),
    complement = (source: DigitSignal[]) =>
      [...source]
        .filter((digit) => !used.has(digit.digit))
        .sort((a, b) => a.positionRank - b.positionRank || b.score - a.score || a.digit.localeCompare(b.digit))[0],
    top = complement(topDigits);
  if (top) used.add(top.digit);
  const bottom = complement(bottomDigits),
    topComplement = top ? [byDigit.get(top.digit) ?? top] : [],
    bottomComplement = bottom ? [byDigit.get(bottom.digit) ?? bottom] : [],
    selected = [...core, ...topComplement, ...bottomComplement],
    fallback = digits.filter((digit) => !selected.some((item) => item.digit === digit.digit));
  return {
    core,
    topComplement,
    bottomComplement,
    digits: [...selected, ...fallback].slice(0, 6),
  };
}

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
