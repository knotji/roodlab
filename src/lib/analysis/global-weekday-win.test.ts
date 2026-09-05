import { describe, expect, it } from "vitest";
import type { LotteryDraw } from "../types";
import { buildGlobalWeekdayWin, deriveDigitsFromFrequentPairs } from "./global-weekday-win";

const draw = (lotteryId: string, drawDate: string, top2: string, bottom2: string): LotteryDraw => ({
  id: `${lotteryId}-${drawDate}`,
  lotteryId,
  drawDate,
  top3: `0${top2}`,
  top2,
  bottom2,
});

describe("global weekday win six", () => {
  it("combines top and bottom digit presence with equal side weight", () => {
    const result = buildGlobalWeekdayWin(
      [{ lotteryId: "a", draws: [draw("a", "2026-08-25", "11", "22")] }],
      { weekday: 2, cutoffDate: "2026-09-01" },
    );
    expect(result.digits.slice(0, 2).map((item) => item.digit)).toEqual(["1", "2"]);
    expect(result.rankedDigits).toHaveLength(10);
    expect(result.digits[0].score).toBe(0.5);
    expect(result.digits[1].score).toBe(0.5);
  });

  it("gives each lottery equal weight instead of rewarding more stored rows", () => {
    const many = Array.from({ length: 12 }, () => draw("a", "2026-08-25", "11", "11")),
      result = buildGlobalWeekdayWin(
        [
          { lotteryId: "a", draws: many },
          { lotteryId: "b", draws: [draw("b", "2026-08-25", "99", "99")] },
        ],
        { weekday: 2, cutoffDate: "2026-09-01" },
      ),
      one = result.digits.find((item) => item.digit === "1"),
      nine = result.digits.find((item) => item.digit === "9");
    expect(one?.score).toBe(nine?.score);
  });

  it("excludes the cutoff date so the shared set stays fixed during the day", () => {
    const result = buildGlobalWeekdayWin(
      [{ lotteryId: "a", draws: [draw("a", "2026-09-01", "99", "99"), draw("a", "2026-08-25", "11", "11")] }],
      { weekday: 2, cutoffDate: "2026-09-01" },
    );
    expect(result.digits[0].digit).toBe("1");
    expect(result.digits.map((item) => item.digit)).not.toContain("9");
  });

  it("ranks exact weekday pairs without losing leading zeroes", () => {
    const result = buildGlobalWeekdayWin(
      [
        { lotteryId: "a", draws: [draw("a", "2026-08-25", "05", "71")] },
        { lotteryId: "b", draws: [draw("b", "2026-08-25", "05", "05")] },
      ],
      { weekday: 2, cutoffDate: "2026-09-01" },
    );
    expect(result.frequentPairs[0]).toMatchObject({ pair: "05", topRate: 1, bottomRate: 0.5, score: 0.75 });
    expect(result.frequentPairs).toHaveLength(50);
    expect(result.frequentDoubles).toHaveLength(3);
    expect(result.frequentDoubles.every((item) => item.pair[0] === item.pair[1])).toBe(true);
    expect(result.frequentDoubles.map((item) => item.score)).toEqual([...result.frequentDoubles.map((item) => item.score)].sort((a, b) => b - a));
    const shown = new Set(result.frequentPairs.map((item) => item.pair));
    expect(result.frequentPairs.every((item) => !shown.has(`${item.pair[1]}${item.pair[0]}`) || item.pair[0] === item.pair[1])).toBe(true);
    expect(result.pairDerivedDigits).toHaveLength(6);
    expect(new Set(result.pairDerivedDigits.map((item) => item.digit)).size).toBe(6);
    expect(result.pairDerivedDigits).toEqual(deriveDigitsFromFrequentPairs(result.frequentPairs.slice(0, 21)));
  });

  it("derives six digits from pair support and counts a double once", () => {
    const pairs = [
      { pair: "11", score: 2, topRate: 0, bottomRate: 0 },
      { pair: "12", score: 1, topRate: 0, bottomRate: 0 },
      { pair: "23", score: 0.5, topRate: 0, bottomRate: 0 },
    ];
    expect(deriveDigitsFromFrequentPairs(pairs, 3)).toEqual([
      { digit: "1", score: 3 },
      { digit: "2", score: 1.5 },
      { digit: "3", score: 0.5 },
    ]);
  });


});
