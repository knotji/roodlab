import { describe, expect, it } from "vitest";
import { buildEqualSourceEvidence, type GeminiEvidenceHistory } from "./gemini-evidence";

describe("Gemini equal-source evidence", () => {
  it("gives each lottery equal weight regardless of observation count", () => {
    const histories: GeminiEvidenceHistory[] = [
      { lotteryId:"many", lotteryName:"many", draws:Array.from({ length:12 }, (_, index) => ({ drawDate:`2026-08-${String(index + 1).padStart(2, "0")}`, top2:"12" })) },
      { lotteryId:"one", lotteryName:"one", draws:[{ drawDate:"2026-08-01", top2:"34" }] },
    ];
    const { pairSummary } = buildEqualSourceEvidence(histories), pair12 = pairSummary.find((item) => item.pair === "12"), pair34 = pairSummary.find((item) => item.pair === "34");
    expect(pair12?.topRate).toBe(0.5);
    expect(pair34?.topRate).toBe(0.5);
    expect(pair12?.equalSourceRate).toBe(pair34?.equalSourceRate);
  });

  it("uses available-side equal weighting without halving a present side", () => {
    const { pairSummary } = buildEqualSourceEvidence([
      { lotteryId:"top-only", lotteryName:"top only", draws:[{ drawDate:"2026-08-01", top2:"12" }] },
    ]), pair12 = pairSummary.find((item) => item.pair === "12");
    expect(pair12).toMatchObject({ topRate:1, bottomRate:0, topSources:1, bottomSources:0, equalSourceRate:1 });
  });
});
