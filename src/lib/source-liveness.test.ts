import { describe, expect, it } from "vitest";
import { ageInDays, classifySourceLiveness, completeDrawGaps, percentileNearestRank } from "./source-liveness";
import type { LotteryDraw } from "./types";

const draw = (date: string, complete = true): LotteryDraw => ({ id: `x-${date}`, lotteryId: "x", drawDate: date, ...(complete ? { top3: "007", top2: "07", bottom2: "00", completeness: "complete" as const } : { completeness: "partial" as const }) });

describe("source liveness diagnostic", () => {
  it("uses only unique complete draws and preserves calendar gaps", () => {
    expect(completeDrawGaps([draw("2026-01-05"), draw("2026-01-03", false), draw("2026-01-02"), draw("2026-01-02")])).toEqual([3]);
    expect(ageInDays("2026-09-04", "2026-09-02")).toBe(2);
  });

  it("computes nearest-rank median and P90", () => {
    expect(percentileNearestRank([1, 2, 3, 4, 10], 0.5)).toBe(3);
    expect(percentileNearestRank([1, 2, 3, 4, 10], 0.9)).toBe(10);
  });

  it("classifies only with at least ten historical gaps", () => {
    expect(classifySourceLiveness({ ageDays: 2, gaps: Array(10).fill(2) }).status).toBe("active-like");
    expect(classifySourceLiveness({ ageDays: 10, gaps: Array(10).fill(2) }).status).toBe("dormant-like");
    expect(classifySourceLiveness({ ageDays: 7, gaps: Array(10).fill(2) }).status).toBe("unknown");
    expect(classifySourceLiveness({ ageDays: 100, gaps: [1, 1] }).status).toBe("unknown");
  });
});
