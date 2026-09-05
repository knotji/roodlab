import { describe, expect, it } from "vitest";
import { buildFocusedWinSet, buildTieredWinSet, buildWinSet, deriveWin6PairSet } from "./win-set";

describe("four-digit win set", () => {
  it("builds every ordered non-double pair from four unique digits", () => {
    expect(buildWinSet(["1", "5", "7", "9"])).toEqual({
      digits: ["1", "5", "7", "9"],
      orderedPairs: [
        "15",
        "17",
        "19",
        "51",
        "57",
        "59",
        "71",
        "75",
        "79",
        "91",
        "95",
        "97",
      ],
      uniquePairs: ["15", "17", "19", "57", "59", "79"],
      doubles: ["11", "55", "77", "99"],
      uniquePairsWithDoubles: [
        "15",
        "17",
        "19",
        "57",
        "59",
        "79",
        "11",
        "55",
        "77",
        "99",
      ],
    });
  });

  it("removes duplicate digits and respects the requested size", () => {
    expect(buildWinSet(["1", "1", "2", "3", "4"], 3).digits).toEqual([
      "1",
      "2",
      "3",
    ]);
    expect(buildWinSet(["1", "1", "2", "3", "4"], 3).uniquePairs).toEqual([
      "12",
      "13",
      "23",
    ]);
    expect(buildWinSet(["1", "1", "2", "3", "4"], 3).doubles).toEqual([
      "11",
      "22",
      "33",
    ]);
  });

  it("scales pair and double counts for seven and eight digits", () => {
    const seven = buildWinSet(["0", "1", "2", "3", "4", "5", "6"], 7),
      eight = buildWinSet(["0", "1", "2", "3", "4", "5", "6", "7"], 8);
    expect(seven.uniquePairs).toHaveLength(21);
    expect(seven.orderedPairs).toHaveLength(42);
    expect(seven.doubles).toHaveLength(7);
    expect(eight.uniquePairs).toHaveLength(28);
    expect(eight.orderedPairs).toHaveLength(56);
    expect(eight.doubles).toHaveLength(8);
  });
});

describe("two-two-two tiered win set", () => {
  it("splits six digits and fifteen pairs into three five-pair tiers", () => {
    expect(buildTieredWinSet(["0", "9", "3", "7", "1", "2"])).toEqual({
      mainDigits: ["0", "9"],
      secondaryDigits: ["3", "7"],
      coverDigits: ["1", "2"],
      primaryPairs: ["09", "03", "07", "93", "97"],
      secondaryPairs: ["01", "02", "91", "92", "37"],
      coverPairs: ["31", "32", "71", "72", "12"],
    });
  });
});

describe("focused six-digit win set", () => {
  it("separates nine core-bearing pairs from six support pairs", () => {
    expect(buildFocusedWinSet(["0", "9", "3", "7", "1", "2"])).toEqual({
      coreDigits: ["0", "9"],
      supportDigits: ["3", "7", "1", "2"],
      focusedPairs: ["09", "03", "07", "01", "02", "93", "97", "91", "92"],
      supportPairs: ["37", "31", "32", "71", "72", "12"],
    });
  });

  it("never duplicates reverse pairs", () => {
    const result = buildFocusedWinSet(["1", "2", "3", "4", "5", "6"]),
      all = [...result.focusedPairs, ...result.supportPairs];
    expect(all).toHaveLength(15);
    expect(new Set(all.map((pair) => [...pair].sort().join(""))).size).toBe(15);
  });
});

describe("Win 6 play-set derivation", () => {
  const WIN_6 = ["1", "2", "3", "4", "8", "9"];

  it("derives exactly the 15 non-double pairs and 6 doubles from the worked example, in Win digit order", () => {
    const result = deriveWin6PairSet(WIN_6);
    expect(result.winDigits).toEqual(WIN_6);
    expect(result.nonDoublePairs).toEqual([
      "12", "13", "14", "18", "19",
      "23", "24", "28", "29",
      "34", "38", "39",
      "48", "49",
      "89",
    ]);
    expect(result.doubles).toEqual(["11", "22", "33", "44", "88", "99"]);
  });

  it("totals 21 items (C(6,2) = 15 non-double pairs + 6 doubles)", () => {
    const result = deriveWin6PairSet(WIN_6);
    expect(result.nonDoublePairs).toHaveLength(15);
    expect(result.doubles).toHaveLength(6);
    expect(result.totalItems).toBe(21);
  });

  it("expands to 36 actual numbers: both directions for the 15 non-double pairs plus the 6 doubles once", () => {
    const result = deriveWin6PairSet(WIN_6);
    expect(result.expandedNumbers).toHaveLength(36);
    expect(new Set(result.expandedNumbers).size).toBe(36); // no duplicate expanded numbers
    for (const pair of result.nonDoublePairs) {
      expect(result.expandedNumbers).toContain(pair);
      expect(result.expandedNumbers).toContain(`${pair[1]}${pair[0]}`); // reverse direction present
    }
    for (const double of result.doubles) {
      expect(result.expandedNumbers.filter((value) => value === double)).toHaveLength(1); // doubles appear once, not twice
    }
  });

  it("has no reversed duplicate canonical pairs in the 15-pair core set", () => {
    const result = deriveWin6PairSet(WIN_6),
      canonical = result.nonDoublePairs.map((pair) => [...pair].sort().join(""));
    expect(new Set(canonical).size).toBe(15);
  });

  it("preserves leading zeroes for both pairs and doubles", () => {
    const result = deriveWin6PairSet(["0", "1", "2", "3", "4", "8"]);
    expect(result.nonDoublePairs).toContain("01");
    expect(result.nonDoublePairs).toContain("04");
    expect(result.nonDoublePairs).toContain("08");
    expect(result.doubles).toContain("00");
    expect(result.expandedNumbers).toContain("01");
    expect(result.expandedNumbers).toContain("10");
  });

  it("requires exactly 6 Win digits", () => {
    expect(() => deriveWin6PairSet(["1", "2", "3", "4", "8"])).toThrow(/exactly 6/);
    expect(() => deriveWin6PairSet(["1", "2", "3", "4", "8", "9", "0"])).toThrow(/exactly 6/);
  });

  it("requires all 6 Win digits to be distinct", () => {
    expect(() => deriveWin6PairSet(["1", "2", "3", "4", "8", "8"])).toThrow(/distinct/);
  });

  it("is deterministic: the same Win 6 always yields the same set", () => {
    expect(deriveWin6PairSet(WIN_6)).toEqual(deriveWin6PairSet([...WIN_6]));
  });

  it("changes output when Win 6 changes", () => {
    const other = deriveWin6PairSet(["0", "5", "6", "7", "2", "3"]);
    expect(other.nonDoublePairs).not.toEqual(deriveWin6PairSet(WIN_6).nonDoublePairs);
  });

  it("depends only on the supplied Win digits - historical/Gemini evidence cannot influence it", () => {
    // deriveWin6PairSet's signature accepts only win digits; there is no parameter through
    // which frequentPairs, evidencePairs, or any other evidence-derived data could reach it.
    expect(deriveWin6PairSet.length).toBe(1);
    expect(deriveWin6PairSet(WIN_6)).toEqual(deriveWin6PairSet(WIN_6));
  });
});
