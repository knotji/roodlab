import { describe, expect, it } from "vitest";
import { GLOBAL_DAILY_SOURCE_IDS } from "./global-daily-sources";
import { classifyGlobalSource, compareOutcomeSources, compareTop6Membership, cosineSimilarity, pearsonCorrelation, topSetOverlap } from "./global-source-redundancy";
import type { LotteryDraw } from "../types";

const draw = (lotteryId: string, date: string, top2: string, bottom2: string): LotteryDraw => ({ id: `${lotteryId}-${date}`, lotteryId, drawDate: date, top3: `0${top2}`, top2, bottom2 });

describe("global source redundancy audit helpers", () => {
  it("classifies stable variants deterministically and leaves ambiguous sources standalone", () => {
    expect(classifyGlobalSource("nikkei-vip-morning")).toMatchObject({ familyId: "nikkei", variant: "VIP / morning", ambiguous: false });
    expect(classifyGlobalSource("laotv")).toMatchObject({ familyId: "source:laotv", ambiguous: true });
    expect(classifyGlobalSource("laotv")).toEqual(classifyGlobalSource("laotv"));
  });

  it("matches only overlapping complete dates while preserving leading zeroes and doubles", () => {
    const result = compareOutcomeSources(
      [draw("a", "2026-01-01", "05", "11"), draw("a", "2026-01-02", "09", "22")],
      [draw("b", "2026-01-01", "05", "11"), draw("b", "2026-01-03", "09", "22")],
    );
    expect(result).toMatchObject({ overlap: 1, exactTopRate: 1, exactBottomRate: 1, exactEitherRate: 1, interpretation: "insufficient" });
    expect(result.topDigitSetJaccard).toBe(1);
  });

  it("applies pre-registered overlap interpretation thresholds", () => {
    const rows = (count: number, id: string) => Array.from({ length: count }, (_, index) => draw(id, `2026-01-${String(index + 1).padStart(2, "0")}`, "12", "34"));
    expect(compareOutcomeSources(rows(9, "a"), rows(9, "b")).interpretation).toBe("insufficient");
    expect(compareOutcomeSources(rows(10, "a"), rows(10, "b")).interpretation).toBe("descriptive");
    expect(compareOutcomeSources(rows(30, "a"), rows(30, "b")).interpretation).toBe("stronger-sample");
  });

  it("computes interpretable vector and Top-N similarities", () => {
    expect(cosineSimilarity([1, 0, 1], [1, 0, 1])).toBeCloseTo(1);
    expect(pearsonCorrelation([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
    expect(topSetOverlap([9,8,7,6,5,4,3,2,1,0], [9,8,7,6,5,4,0,1,2,3])).toBe(1);
  });

  it("compares leave-one-family-out membership without mutating production configuration", () => {
    const before = [...GLOBAL_DAILY_SOURCE_IDS];
    expect(compareTop6Membership(["1","2","3","4","5","6"], ["1","2","3","4","5","7"])).toEqual({ overlap: 5, changedDigits: 1, exactSameOrder: false });
    expect(GLOBAL_DAILY_SOURCE_IDS).toEqual(before);
  });
});
