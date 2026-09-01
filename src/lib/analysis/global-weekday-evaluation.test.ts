import { describe, expect, it } from "vitest";
import type { LotteryDraw } from "../types";
import { composeGlobal411, digitRecall, exactRandomBothCoverage, exactRandomPairCoverage, pairCovered, rankGlobalWeekdayMethod, type RankedGlobalDigit } from "./global-weekday-evaluation";

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

  it.each(["three-block-stability", "lottery-consensus", "top-bottom-balance"] as const)("ranks %s without target leakage", (method) => {
    const weekdays = ["2026-08-25", "2026-08-18", "2026-08-11", "2026-08-04"].map((date) => draw("a", date, "22")),
      filler = Array.from({ length: 28 }, (_, index) => draw("a", `2026-07-${String(index + 1).padStart(2, "0")}`, "34")),
      sources = [{ lotteryId: "a", draws: [...weekdays, ...filler] }], options = { weekday: 2 as const, cutoffDate: "2026-09-01" },
      before = rankGlobalWeekdayMethod(sources, method, options), after = rankGlobalWeekdayMethod([{ lotteryId: "a", draws: [draw("a", "2026-09-01", "99"), ...weekdays, ...filler] }], method, options);
    expect(before).toHaveLength(10);
    expect(after).toEqual(before);
  });

  it("composes four combined, one top, and one bottom digit without duplicates", () => {
    const ranking = (digits: string[]) => digits.map((digit, index) => ({ digit, score: 10 - index, weekdayRate: 0, allDaysRate: 0 })) as RankedGlobalDigit[];
    expect(composeGlobal411(ranking(["1","2","3","4","5","6","7","8","9","0"]), ranking(["1","8","2","3","4","5","6","7","9","0"]), ranking(["2","8","9","1","3","4","5","6","7","0"])).slice(0, 6).map((item) => item.digit)).toEqual(["1","2","3","4","8","9"]);
  });
});
