import { describe, expect, it } from "vitest";
import { evaluateProductionOutcome, summarizeProductionEvidence, type ProductionEvidenceRow } from "./global-production-evidence";

describe("global production evidence", () => {
  it("uses the same unordered Win 6 coverage contract and handles doubles exactly", () => {
    const selected = ["0", "1", "2", "3", "4", "5"];
    expect(evaluateProductionOutcome(selected, "50", "66")).toMatchObject({ top: 1, bottom: 0, either: 1, both: 0 });
    expect(evaluateProductionOutcome(selected, "00", "55")).toMatchObject({ top: 1, bottom: 1, either: 1, both: 1 });
    expect(evaluateProductionOutcome(selected, "00", "55").expectedTop).toBeCloseTo(0.6);
    expect(evaluateProductionOutcome(selected, "01", "55").expectedTop).toBeCloseTo(1 / 3);
  });

  it("aggregates by outcome count rather than giving sparse dates extra weight", () => {
    const row = (overrides: Partial<ProductionEvidenceRow>): ProductionEvidenceRow => ({
      date: "2026-09-01", outcomes: 1, topHits: 0, bottomHits: 0, eitherHits: 0, bothHits: 0, digitRecallTotal: 0,
      expectedTop: 0, expectedBottom: 0, expectedEither: 0, expectedBoth: 0, expectedDigitRecall: 0, ...overrides,
    });
    const result = summarizeProductionEvidence([
      row({ outcomes: 1, eitherHits: 1, expectedEither: 0.5 }),
      row({ date: "2026-09-02", outcomes: 3, expectedEither: 1.5 }),
    ]);
    expect(result.metrics.either.rate).toBe(0.25);
    expect(result.metrics.either.baseline).toBe(0.5);
    expect(result.metrics.either.uplift).toBe(-0.25);
  });
});
