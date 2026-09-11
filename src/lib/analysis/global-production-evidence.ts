import { exactRandomBothCoverage, exactRandomPairCoverage, pairCovered } from "./global-weekday-evaluation";

export type ProductionEvidenceRow = {
  date: string;
  outcomes: number;
  topHits: number;
  bottomHits: number;
  eitherHits: number;
  bothHits: number;
  digitRecallTotal: number;
  expectedTop: number;
  expectedBottom: number;
  expectedEither: number;
  expectedBoth: number;
  expectedDigitRecall: number;
};

export const PRODUCTION_WIN_SIZE = 6;

export function evaluateProductionOutcome(selected: readonly string[], top2: string, bottom2: string) {
  const top = pairCovered(selected, top2),
    bottom = pairCovered(selected, bottom2),
    selectedSet = new Set(selected),
    digits = `${top2}${bottom2}`.split(""),
    expectedTop = exactRandomPairCoverage(top2, selected.length),
    expectedBottom = exactRandomPairCoverage(bottom2, selected.length),
    expectedBoth = exactRandomBothCoverage(top2, bottom2, selected.length);
  return {
    top: Number(top),
    bottom: Number(bottom),
    either: Number(top || bottom),
    both: Number(top && bottom),
    digitRecall: digits.filter((digit) => selectedSet.has(digit)).length / digits.length,
    expectedTop,
    expectedBottom,
    expectedEither: expectedTop + expectedBottom - expectedBoth,
    expectedBoth,
    // Every individual digit has size / 10 inclusion probability. Repeated
    // positions, including doubles, remain separate recall positions.
    expectedDigitRecall: selected.length / 10,
  };
}

export function summarizeProductionEvidence(rows: readonly ProductionEvidenceRow[]) {
  const outcomes = rows.reduce((sum, row) => sum + row.outcomes, 0);
  if (!outcomes) throw new Error("Cannot summarize production evidence without outcomes");
  const metric = (actual: keyof ProductionEvidenceRow, expected: keyof ProductionEvidenceRow) => {
    const rate = rows.reduce((sum, row) => sum + Number(row[actual]), 0) / outcomes,
      baseline = rows.reduce((sum, row) => sum + Number(row[expected]), 0) / outcomes;
    return { rate, baseline, uplift: rate - baseline };
  };
  return {
    dates: rows.length,
    outcomes,
    metrics: {
      top: metric("topHits", "expectedTop"),
      bottom: metric("bottomHits", "expectedBottom"),
      either: metric("eitherHits", "expectedEither"),
      both: metric("bothHits", "expectedBoth"),
      digitRecall: metric("digitRecallTotal", "expectedDigitRecall"),
    },
  };
}
