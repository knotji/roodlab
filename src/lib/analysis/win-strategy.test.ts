import { describe, expect, it } from "vitest";
import { fixtureHistory } from "../fixtures";
import { analyzeLottery } from "./engine";
import { buildConsensus } from "./consensus";
import { buildDiversifiedWinSix, historicalWinCoverage } from "./win-strategy";

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
