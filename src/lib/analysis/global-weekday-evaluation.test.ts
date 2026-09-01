import { describe, expect, it } from "vitest";
import type { LotteryDraw } from "../types";
import { digitRecall, exactRandomBothCoverage, exactRandomPairCoverage, pairCovered, rankGlobalWeekdayMethod } from "./global-weekday-evaluation";

const draw = (lotteryId: string, drawDate: string, top2: string, bottom2 = top2): LotteryDraw => ({ id: `${lotteryId}-${drawDate}-${top2}`, lotteryId, drawDate, top3: `0${top2}`, top2, bottom2 });

describe("global weekday evaluation", () => {
  it("ranks weekday lift against the same lotteries' all-days rates", () => {
    const tuesdays = ["2026-08-25", "2026-08-18", "2026-08-11", "2026-08-04"].map((date) => draw("a", date, "99")),
      otherDays = Array.from({ length: 28 }, (_, index) => draw("a", `2026-07-${String(index + 1).padStart(2, "0")}`, "11")),
      ranked = rankGlobalWeekdayMethod([{ lotteryId: "a", draws: [...tuesdays, ...otherDays] }], "weekday-lift", { weekday: 2, cutoffDate: "2026-09-01" });
    expect(ranked[0].digit).toBe("9");
    expect(ranked[0].score).toBeGreaterThan(0);
  });

  it("never lets a target or future draw alter an earlier ranking", () => {
    const history = ["2026-08-25", "2026-08-18", "2026-08-11", "2026-08-04"].map((date) => draw("a", date, "22")),
      filler = Array.from({ length: 28 }, (_, index) => draw("a", `2026-07-${String(index + 1).padStart(2, "0")}`, "34")),
      base = rankGlobalWeekdayMethod([{ lotteryId: "a", draws: [...history, ...filler] }], "weekday-lift", { weekday: 2, cutoffDate: "2026-09-01" }),
      changed = rankGlobalWeekdayMethod([{ lotteryId: "a", draws: [draw("a", "2026-09-01", "99"), ...history, ...filler] }], "weekday-lift", { weekday: 2, cutoffDate: "2026-09-01" });
    expect(changed).toEqual(base);
  });

  it("uses exact set baselines for distinct pairs, doubles, and both sides", () => {
    expect(pairCovered(["1", "2"], "12")).toBe(true);
    expect(pairCovered(["1", "2"], "11")).toBe(true);
    expect(digitRecall(["1"], ["12", "11"])).toBe(0.75);
    expect(exactRandomPairCoverage("12", 6)).toBeCloseTo(1 / 3);
    expect(exactRandomPairCoverage("11", 6)).toBeCloseTo(0.6);
    expect(exactRandomBothCoverage("12", "34", 6)).toBeCloseTo(1 / 14);
  });
});
