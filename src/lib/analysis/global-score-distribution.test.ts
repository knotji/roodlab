import { describe, expect, it } from "vitest";
import { analyzeGlobalScoreDistribution, formatRankBoundaryGap, rankGlobalDigitScores, type GlobalScoreInput } from "./global-score-distribution";

const scores = (values: number[]): GlobalScoreInput[] => values.map((score, digit) => ({ digit: String(digit), score, topRate: score, bottomRate: score }));

describe("global score distribution diagnostic", () => {
  it("describes ten equal scores as flat without inventing separation", () => {
    const result = analyzeGlobalScoreDistribution(scores(Array(10).fill(0.2)));
    expect(result.rank6To7Gap).toBe(0);
    expect(result.top6Spread).toBe(0);
    expect(result.allDigitSpread).toBe(0);
    expect(result.normalizedEntropy).toBeCloseTo(1);
    expect(result.concentration).toBeCloseTo(0);
  });

  it("measures a clear rank-six boundary", () => {
    const result = analyzeGlobalScoreDistribution(scores([1, .9, .8, .7, .6, .5, .1, .09, .08, .07]));
    expect(result.rank6To7Gap).toBeCloseTo(0.4);
    expect(result.top6Spread).toBeCloseTo(0.5);
    expect(result.allDigitSpread).toBeCloseTo(0.93);
  });

  it("preserves a very small boundary gap", () => {
    expect(analyzeGlobalScoreDistribution(scores([1, .9, .8, .7, .6, .5001, .5, .4, .3, .2])).rank6To7Gap).toBeCloseTo(0.0001);
  });

  it("reports zero gap for a tie around ranks six and seven", () => {
    expect(analyzeGlobalScoreDistribution(scores([1, .9, .8, .7, .6, .5, .5, .4, .3, .2])).rank6To7Gap).toBe(0);
  });

  it("handles zero and near-zero scores", () => {
    const zero = analyzeGlobalScoreDistribution(scores(Array(10).fill(0))), nearZero = analyzeGlobalScoreDistribution(scores([1e-12, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
    expect(zero.normalizedEntropy).toBe(1);
    expect(zero.concentration).toBe(0);
    expect(nearZero.normalizedEntropy).toBeCloseTo(0);
    expect(nearZero.concentration).toBeCloseTo(1);
  });

  it("uses the same deterministic ties as the production ranking", () => {
    const input: GlobalScoreInput[] = [
      { digit: "8", score: .2, topRate: .1, bottomRate: .3 },
      { digit: "2", score: .2, topRate: .2, bottomRate: .2 },
      { digit: "1", score: .2, topRate: .2, bottomRate: .2 },
    ];
    expect(rankGlobalDigitScores(input).map((item) => item.digit)).toEqual(["1", "2", "8"]);
  });

  it("formats the boundary gap at readable precision without making zero look different", () => {
    expect(formatRankBoundaryGap(0)).toBe("คะแนนอันดับ 6 และ 7 เท่ากัน");
    expect(formatRankBoundaryGap(0.00001)).toBe("อันดับ 6 กับอันดับ 7 ต่างกันน้อยกว่า 0.01 จุด");
    expect(formatRankBoundaryGap(0.0042)).toBe("อันดับ 6 กับอันดับ 7 ต่างกัน 0.42 จุด");
  });
});
