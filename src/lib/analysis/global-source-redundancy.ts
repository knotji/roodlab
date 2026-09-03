import type { LotteryDraw } from "../types";

export type FamilyClassification = {
  familyId: string;
  familyLabel: string;
  variant: string;
  rationale: string;
  ambiguous: boolean;
};

const PREFIX_FAMILIES = [
  { prefixes: ["nikkei-"], familyId: "nikkei", familyLabel: "Nikkei", rationale: "stable Nikkei identifier with morning/afternoon and VIP variants" },
  { prefixes: ["szse-"], familyId: "china", familyLabel: "China / SZSE", rationale: "stable SZSE identifier with morning/afternoon and VIP variants" },
  { prefixes: ["hsi-"], familyId: "hang-seng", familyLabel: "Hang Seng / HSI", rationale: "stable HSI identifier with morning/afternoon and VIP variants" },
] as const;

const EXPLICIT_FAMILIES: Record<string, Omit<FamilyClassification, "variant" | "ambiguous">> = {
  "twse": { familyId: "taiwan", familyLabel: "Taiwan / TWSE", rationale: "same TWSE market with standard and VIP variants" },
  "twse-vip": { familyId: "taiwan", familyLabel: "Taiwan / TWSE", rationale: "same TWSE market with standard and VIP variants" },
  "ktop30": { familyId: "korea", familyLabel: "Korea / KTOP30", rationale: "same KTOP30 market with standard and VIP variants" },
  "ktop30-vip": { familyId: "korea", familyLabel: "Korea / KTOP30", rationale: "same KTOP30 market with standard and VIP variants" },
  "sgx": { familyId: "singapore", familyLabel: "Singapore / SGX", rationale: "same SGX market with standard and VIP variants" },
  "sgx-vip": { familyId: "singapore", familyLabel: "Singapore / SGX", rationale: "same SGX market with standard and VIP variants" },
  "laostars": { familyId: "lao-stars", familyLabel: "Lao Stars", rationale: "same named Lao Stars source with standard and VIP variants" },
  "laostarsvip": { familyId: "lao-stars", familyLabel: "Lao Stars", rationale: "same named Lao Stars source with standard and VIP variants" },
  "laounion": { familyId: "lao-union", familyLabel: "Lao Union", rationale: "same named Lao Union source with standard and VIP variants" },
  "laounionvip": { familyId: "lao-union", familyLabel: "Lao Union", rationale: "same named Lao Union source with standard and VIP variants" },
  "england-vip": { familyId: "superrich-vip", familyLabel: "Superrich international VIP", rationale: "shared live-result provider lottosuperrich.com" },
  "germany-vip": { familyId: "superrich-vip", familyLabel: "Superrich international VIP", rationale: "shared live-result provider lottosuperrich.com" },
  "russia-vip": { familyId: "superrich-vip", familyLabel: "Superrich international VIP", rationale: "shared live-result provider lottosuperrich.com" },
};

function variantLabel(id: string) {
  return [id.includes("vip") ? "VIP" : "standard", id.includes("morning") ? "morning" : id.includes("afternoon") ? "afternoon" : "single session"].join(" / ");
}

export function classifyGlobalSource(lotteryId: string): FamilyClassification {
  const prefixed = PREFIX_FAMILIES.find((family) => family.prefixes.some((prefix) => lotteryId.startsWith(prefix)));
  if (prefixed) return { familyId: prefixed.familyId, familyLabel: prefixed.familyLabel, variant: variantLabel(lotteryId), rationale: prefixed.rationale, ambiguous: false };
  const explicit = EXPLICIT_FAMILIES[lotteryId];
  if (explicit) return { ...explicit, variant: variantLabel(lotteryId), ambiguous: false };
  return { familyId: `source:${lotteryId}`, familyLabel: lotteryId, variant: "standalone", rationale: "no conservative structural family match; retained as its own family", ambiguous: true };
}

function digitSet(value: string) { return new Set(value.split("")); }
function jaccard(left: Set<string>, right: Set<string>) { const union = new Set([...left, ...right]); return union.size ? [...left].filter((value) => right.has(value)).length / union.size : 0; }
function presenceVector(...values: string[]) { const present = new Set(values.join("").split("")); return Array.from({ length: 10 }, (_, digit) => Number(present.has(String(digit)))); }

export type PairwiseOutcome = {
  overlap: number;
  exactTopRate: number;
  exactBottomRate: number;
  exactEitherRate: number;
  exactTopUpliftVsUniform: number;
  exactBottomUpliftVsUniform: number;
  exactEitherUpliftVsUniform: number;
  topDigitSetJaccard: number;
  bottomDigitSetJaccard: number;
  combinedDigitPresenceJaccard: number;
  combinedPresenceCosine: number;
  interpretation: "insufficient" | "descriptive" | "stronger-sample";
};

export function compareOutcomeSources(left: readonly LotteryDraw[], right: readonly LotteryDraw[]): PairwiseOutcome {
  const byDate = new Map(left.filter((draw) => draw.top2 && draw.bottom2).map((draw) => [draw.drawDate, draw])), aligned = right.filter((draw) => draw.top2 && draw.bottom2 && byDate.has(draw.drawDate));
  const sums = aligned.reduce((total, draw) => {
    const other = byDate.get(draw.drawDate)!, leftTop = other.top2!, leftBottom = other.bottom2!, rightTop = draw.top2!, rightBottom = draw.bottom2!;
    total.exactTop += Number(leftTop === rightTop); total.exactBottom += Number(leftBottom === rightBottom); total.exactEither += Number(leftTop === rightTop || leftBottom === rightBottom);
    total.topJaccard += jaccard(digitSet(leftTop), digitSet(rightTop)); total.bottomJaccard += jaccard(digitSet(leftBottom), digitSet(rightBottom));
    total.combinedJaccard += jaccard(digitSet(`${leftTop}${leftBottom}`), digitSet(`${rightTop}${rightBottom}`)); total.cosine += cosineSimilarity(presenceVector(leftTop, leftBottom), presenceVector(rightTop, rightBottom));
    return total;
  }, { exactTop: 0, exactBottom: 0, exactEither: 0, topJaccard: 0, bottomJaccard: 0, combinedJaccard: 0, cosine: 0 });
  const overlap = aligned.length, rate = (value: number) => overlap ? value / overlap : 0;
  return {
    overlap, exactTopRate: rate(sums.exactTop), exactBottomRate: rate(sums.exactBottom), exactEitherRate: rate(sums.exactEither),
    exactTopUpliftVsUniform: rate(sums.exactTop) - 0.01, exactBottomUpliftVsUniform: rate(sums.exactBottom) - 0.01, exactEitherUpliftVsUniform: rate(sums.exactEither) - 0.0199,
    topDigitSetJaccard: rate(sums.topJaccard), bottomDigitSetJaccard: rate(sums.bottomJaccard), combinedDigitPresenceJaccard: rate(sums.combinedJaccard), combinedPresenceCosine: rate(sums.cosine),
    interpretation: overlap < 10 ? "insufficient" : overlap < 30 ? "descriptive" : "stronger-sample",
  };
}

export function cosineSimilarity(left: readonly number[], right: readonly number[]) {
  const dot = left.reduce((sum, value, index) => sum + value * right[index], 0), a = Math.sqrt(left.reduce((sum, value) => sum + value ** 2, 0)), b = Math.sqrt(right.reduce((sum, value) => sum + value ** 2, 0));
  return a && b ? dot / (a * b) : 0;
}

export function pearsonCorrelation(left: readonly number[], right: readonly number[]) {
  if (left.length !== right.length || left.length < 2) return 0;
  const leftMean = left.reduce((a, b) => a + b, 0) / left.length, rightMean = right.reduce((a, b) => a + b, 0) / right.length,
    numerator = left.reduce((sum, value, index) => sum + (value - leftMean) * (right[index] - rightMean), 0),
    a = Math.sqrt(left.reduce((sum, value) => sum + (value - leftMean) ** 2, 0)), b = Math.sqrt(right.reduce((sum, value) => sum + (value - rightMean) ** 2, 0));
  return a && b ? numerator / (a * b) : 0;
}

export function topSetOverlap(left: readonly number[], right: readonly number[], size = 6) {
  const ranked = (values: readonly number[]) => values.map((score, digit) => ({ digit: String(digit), score })).sort((a, b) => b.score - a.score || a.digit.localeCompare(b.digit)).slice(0, size).map((item) => item.digit),
    a = new Set(ranked(left)), b = new Set(ranked(right));
  return [...a].filter((digit) => b.has(digit)).length / size;
}

export function compareTop6Membership(normal: readonly string[], withoutFamily: readonly string[]) {
  const other = new Set(withoutFamily), overlap = normal.filter((digit) => other.has(digit)).length;
  return { overlap, changedDigits: normal.length - overlap, exactSameOrder: normal.join("") === withoutFamily.join("") };
}
