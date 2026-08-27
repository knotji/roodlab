import { describe, expect, it } from "vitest";
import { ALGORITHMS } from "./algorithms";
import {
  ALL_STANDOUT_PAIRS,
  bootstrapPairedUplift,
  combinatorialRandomHitProbability,
  enumeratedRandomHitProbability,
  pairedUplift,
  standoutHit,
  standoutTarget,
} from "./standout-baseline";
describe("standout exact random baseline", () => {
  it("generates exactly 45 unique unordered pairs deterministically", () => {
    expect(ALL_STANDOUT_PAIRS).toHaveLength(45);
    expect(new Set(ALL_STANDOUT_PAIRS).size).toBe(45);
    expect(ALL_STANDOUT_PAIRS.every((x) => x[0] < x[1])).toBe(true);
  });
  it("shares production hit semantics for top3 plus bottom2, not top2", () => {
    const draw = { top3: "755", top2: "09", bottom2: "12" };
    expect(standoutHit(["1", "5"], draw)).toBe(true);
    expect(standoutHit(["0", "9"], draw)).toBe(false);
    expect(standoutTarget(draw)).toEqual({
      digits: ["1", "2", "5", "7"],
      sourceFields: ["top3", "bottom2"],
      uniqueDigitCount: 4,
      rawDigits: "75512",
    });
  });
  it("collapses duplicate target digits", () =>
    expect(
      standoutTarget({ top3: "555", bottom2: "55" }).uniqueDigitCount,
    ).toBe(1));
  it("handles missing fields without inventing targets", () => {
    expect(standoutTarget({ top3: "012" })).toMatchObject({
      digits: ["0", "1", "2"],
      sourceFields: ["top3"],
    });
    expect(standoutTarget({})).toMatchObject({
      digits: [],
      sourceFields: [],
      uniqueDigitCount: 0,
    });
  });
  it("matches combinatorics and enumeration for every target size", () => {
    for (let k = 0; k <= 10; k++) {
      const digits = Array.from({ length: k }, (_, i) => String(i)).join(""),
        draw = {
          top3: digits.slice(0, 3) || undefined,
          bottom2: digits.slice(3, 5) || undefined,
        };
      expect(enumeratedRandomHitProbability(draw)).toBeCloseTo(
        combinatorialRandomHitProbability(draw),
        12,
      );
    }
  });
  it("computes per-draw exact probability", () =>
    expect(enumeratedRandomHitProbability({ top3: "755", bottom2: "12" })).toBe(
      30 / 45,
    ));
  it("aggregates expected hits and paired uplift", () =>
    expect(
      pairedUplift([
        { outcome: 1, expected: 0.5 },
        { outcome: 0, expected: 0.25 },
      ]),
    ).toMatchObject({
      n: 2,
      observedHits: 1,
      expectedHits: 0.75,
      observedRate: 0.5,
      baselineRate: 0.375,
      excessHits: 0.25,
      uplift: 0.125,
    }));
  it("bootstraps deterministically", () => {
    const rows = [
      { outcome: 1 as const, expected: 0.5 },
      { outcome: 0 as const, expected: 0.25 },
      { outcome: 1 as const, expected: 0.75 },
    ];
    expect(bootstrapPairedUplift(rows, 1000, 42)).toEqual(
      bootstrapPairedUplift(rows, 1000, 42),
    );
  });
  it("does not mutate frozen algorithm definitions", () => {
    const before = JSON.stringify(ALGORITHMS);
    enumeratedRandomHitProbability({ top3: "755", bottom2: "12" });
    expect(JSON.stringify(ALGORITHMS)).toBe(before);
  });
});
