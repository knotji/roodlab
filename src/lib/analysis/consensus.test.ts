import { describe, expect, it } from "vitest";
import { fixtureHistory } from "../fixtures";
import { ALGORITHMS } from "./algorithms";
import { buildConsensus } from "./consensus";

describe("formula consensus", () => {
  it("counts top-four agreement across every frozen algorithm", () => {
    const result = buildConsensus(fixtureHistory, {
      window: 30,
      candidateCount: 4,
      includeDoubles: true,
    });
    expect(result.formulaCount).toBe(ALGORITHMS.length);
    expect(result.digits).toHaveLength(10);
    expect(
      result.digits.every((item) => item.votes >= 0 && item.votes <= 5),
    ).toBe(true);
    expect(result.digits.reduce((total, item) => total + item.votes, 0)).toBe(
      ALGORITHMS.length * 5,
    );
    expect(result.digits).toEqual(
      [...result.digits].sort(
        (a, b) =>
          b.votes - a.votes ||
          a.averageRank - b.averageRank ||
          a.digit.localeCompare(b.digit),
      ),
    );
  });

  it("reports insufficient stability when only one window is available", () => {
    const result = buildConsensus(fixtureHistory.slice(0, 15), {
      window: 10,
      candidateCount: 4,
      includeDoubles: true,
    });
    expect(result.eligibleWindows).toEqual([10]);
    expect(result.stabilityScore).toBeNull();
    expect(result.stabilityStatus).toBe("insufficient");
  });

  it("is deterministic and does not modify the frozen registry", () => {
    const before = JSON.stringify(ALGORITHMS),
      options = { window: 30, candidateCount: 4, includeDoubles: false };
    expect(buildConsensus(fixtureHistory, options)).toEqual(
      buildConsensus(fixtureHistory, options),
    );
    expect(JSON.stringify(ALGORITHMS)).toBe(before);
  });
});
