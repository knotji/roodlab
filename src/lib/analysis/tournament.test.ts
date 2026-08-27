import { describe, expect, it } from "vitest";
import { CORE_CANDIDATES } from "./core-candidates";
import {
  chronologicalSplit,
  demonstratesConsistentImprovement,
  robustnessScore,
  weightedRate,
} from "./tournament";
import { analyzeLottery } from "./engine";
import { fixtureHistory } from "../fixtures";
import { resolveAlgorithmSelection } from "../lottery-store";
describe("core tournament protocol", () => {
  it("keeps candidate ids and versions unique and deterministic", () => {
    expect(
      new Set(CORE_CANDIDATES.map((x) => `${x.id}@${x.version}`)).size,
    ).toBe(CORE_CANDIDATES.length);
    for (const c of CORE_CANDIDATES) {
      const options = {
        algorithmId: "custom",
        customWeights: {
          digitWeights: c.digitWeights,
          pairWeights: c.pairWeights,
        },
      };
      expect(analyzeLottery(fixtureHistory, options)).toEqual(
        analyzeLottery(fixtureHistory, options),
      );
      expect(
        Object.values(c.digitWeights).reduce((a, b) => a + b, 0),
      ).toBeCloseTo(1);
      expect(
        Object.values(c.pairWeights).reduce((a, b) => a + b, 0),
      ).toBeCloseTo(1);
    }
  });
  it("separates chronological development and holdout", () => {
    const values = Array.from({ length: 100 }, (_, i) => i),
      split = chronologicalSplit(values);
    expect(split.development.at(-1)).toBeLessThan(split.holdout[0]);
    expect(split.development).toHaveLength(75);
    expect(split.holdout).toHaveLength(25);
  });
  it("uses weighted counts instead of mean percentages", () =>
    expect(
      weightedRate([
        { hits: 1, total: 2 },
        { hits: 0, total: 100 },
      ]),
    ).toEqual({ hits: 1, total: 102, rate: 1 / 102 }));
  it("calculates the documented robustness weights", () =>
    expect(
      robustnessScore({
        crossLotteryConsistency: 100,
        longHorizonPerformance: 80,
        pairRankingQuality: 60,
        standoutPerformance: 40,
        downsideProtection: 20,
      }),
    ).toBe(73));
  it("rejects mixed holdout improvement", () =>
    expect(
      demonstratesConsistentImprovement(
        {
          top1: 0.0096,
          top4: 0.0488,
          top10: 0.1104,
          top20: 0.1953,
          meanRank: 51.16,
          worstQuartileTop10: 0.048,
          dispersion: 0.0482,
        },
        {
          top1: 0.0127,
          top4: 0.0382,
          top10: 0.1019,
          top20: 0.2006,
          meanRank: 50.97,
          worstQuartileTop10: 0.0363,
          dispersion: 0.0462,
        },
      ),
    ).toBe(false));
  it("preserves an explicit selection while allowing application-default migration", () => {
    expect(resolveAlgorithmSelection("balanced-v1", true, "roodlab-core-v1")).toBe("balanced-v1");
    expect(resolveAlgorithmSelection("balanced-v1", false, "roodlab-core-v1")).toBe("roodlab-core-v1");
  });
});
