import { describe, expect, it } from "vitest";
import { fixtureHistory } from "../fixtures";
import { analyzeLottery } from "./engine";
import { buildConsensus } from "./consensus";
import { buildDiversifiedWinSix, buildStableWinSix, evaluateWinTracking, historicalWinCoverage } from "./win-strategy";

describe("diversified win six", () => {
  it("selects three consensus, two position, and one momentum digit without duplicates", () => {
    const analysis = analyzeLottery(fixtureHistory),
      consensus = buildConsensus(fixtureHistory, {
        window: 30,
        candidateCount: 4,
        includeDoubles: false,
      }),
      result = buildDiversifiedWinSix(analysis.digits, consensus);

    expect(result.main).toHaveLength(3);
    expect(result.position).toHaveLength(2);
    expect(result.contrarian).toHaveLength(1);
    expect(new Set(result.digits.map((digit) => digit.digit))).toHaveLength(6);
  });

  it("reports descriptive coverage and a same-definition random baseline", () => {
    const result = historicalWinCoverage(fixtureHistory.slice(0, 30), ["0", "1", "2", "3", "4", "5"]);
    expect(result.total).toBe(30);
    expect(result.hits).toBeLessThanOrEqual(result.total);
    expect(result.rate).toBeGreaterThanOrEqual(0);
    expect(result.randomBaseline).toBeGreaterThan(0);
    expect(result.randomBaseline).toBeLessThanOrEqual(1);
  });
});

describe("stable 4+1+1 win six", () => {
  it("selects four stable core digits and distinct top/bottom complements", () => {
    const analysis = analyzeLottery(fixtureHistory),
      consensus = buildConsensus(fixtureHistory, {
        window: 30,
        candidateCount: 4,
        includeDoubles: false,
      }),
      result = buildStableWinSix(
        analysis.digits,
        analysis.topDigits,
        analysis.bottomDigits,
        consensus,
      );

    expect(result.core).toHaveLength(4);
    expect(result.topComplement).toHaveLength(1);
    expect(result.bottomComplement).toHaveLength(1);
    expect(new Set(result.digits.map((digit) => digit.digit))).toHaveLength(6);
  });
});

describe("win tracking gate", () => {
  const evidence = {
    stable: true,
    consensusMainVotes: [5, 4],
    selectedCoreVotes: [3, 4],
    distributedInsertBestRanks: [3, 5],
    diversifiedMainVotes: [5, 4, 3],
    diversifiedPositionRanks: [2, 5],
    diversifiedMomentum: 1,
    stableCoreVotes: [5, 5, 4, 3],
    stableCoreWindows: [4, 3, 3, 2],
    stableTopPositionRank: 3,
    stableBottomPositionRank: 5,
  };

  it("passes each mode only when every documented check passes", () => {
    for (const mode of ["tiered", "core-support", "distributed", "diversified", "stable-411"] as const)
      expect(evaluateWinTracking(mode, evidence).passed).toBe(true);
  });

  it("does not turn incomplete evidence into a percentage or passing state", () => {
    const result = evaluateWinTracking("diversified", {
      ...evidence,
      diversifiedMomentum: 0,
    });
    expect(result.passed).toBe(false);
    expect(result.checks.find((check) => check.label.includes("Momentum"))?.passed).toBe(false);
  });
});
