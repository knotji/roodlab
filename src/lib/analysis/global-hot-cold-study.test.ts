import { describe, expect, it } from "vitest";
import type { LotteryDraw } from "../types";
import { buildGlobalWeekdayWin } from "./global-weekday-win";
import { classifyPairedOutcome, evaluateStrategyOutcome, selectHot3Cold3, selectOverallTop6 } from "./global-hot-cold-study";

const ranking = ["9", "8", "7", "6", "5", "4", "3", "2", "1", "0"].map((digit, index) => ({ digit, score: 10 - index, topRate: 0, bottomRate: 0 }));
const draw = (drawDate: string, top2: string): LotteryDraw => ({ id: `${drawDate}-${top2}`, lotteryId: "a", drawDate, top3: `0${top2}`, top2, bottom2: top2 });

describe("pre-registered global Hot3Cold3 study", () => {
  it("selects exactly ranks 1-6 for Overall Top 6", () => {
    expect(selectOverallTop6(ranking)).toEqual(["9", "8", "7", "6", "5", "4"]);
  });

  it("selects exactly ranks 1-3 and 8-10 for Hot3Cold3", () => {
    expect(selectHot3Cold3(ranking)).toEqual(["9", "8", "7", "2", "1", "0"]);
  });

  it("returns six unique digits for both frozen strategies", () => {
    for (const selected of [selectOverallTop6(ranking), selectHot3Cold3(ranking)]) expect(new Set(selected).size).toBe(6);
  });

  it("inherits deterministic ties and target exclusion from production ranking", () => {
    const history = [draw("2026-08-25", "11"), draw("2026-08-18", "22")],
      base = buildGlobalWeekdayWin([{ lotteryId: "a", draws: history }], { weekday: 2, cutoffDate: "2026-09-01" }),
      withTarget = buildGlobalWeekdayWin([{ lotteryId: "a", draws: [draw("2026-09-01", "99"), ...history] }], { weekday: 2, cutoffDate: "2026-09-01" });
    expect(withTarget.rankedDigits).toEqual(base.rankedDigits);
    expect(base.rankedDigits.filter((item) => item.score === 0).map((item) => item.digit)).toEqual(["0", "3", "4", "5", "6", "7", "8", "9"]);
  });

  it("handles double pairs and classifies paired outcomes", () => {
    const overall = evaluateStrategyOutcome(["1", "2", "3", "4", "5", "6"], "11", "78"),
      hotCold = evaluateStrategyOutcome(["0", "2", "3", "7", "8", "9"], "11", "78");
    expect(overall).toMatchObject({ top: true, bottom: false, either: true });
    expect(hotCold).toMatchObject({ top: false, bottom: true, either: true });
    expect(classifyPairedOutcome(overall, hotCold)).toBe("both");
    expect(classifyPairedOutcome(overall, evaluateStrategyOutcome(["0", "2", "3", "7", "9", "6"], "11", "78"))).toBe("overallOnly");
  });
});
