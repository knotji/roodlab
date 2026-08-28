import { describe, expect, it } from "vitest";
import { buildFocusedWinSet, buildWinSet } from "./win-set";

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
