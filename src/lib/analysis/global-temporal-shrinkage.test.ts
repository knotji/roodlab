import { describe, expect, it } from "vitest";
import { rankTemporalShrinkage } from "./global-temporal-shrinkage";
import type { LotteryDraw } from "../types";

function draw(date: string, pair: string): LotteryDraw {
  return { id: date, lotteryId: "x", drawDate: date, top3: `0${pair}`, top2: pair, bottom2: pair };
}

describe("global temporal shrinkage", () => {
  it("never reads the target or future outcome", () => {
    const history = Array.from({ length: 40 }, (_, index) => draw(`2026-${String(1 + Math.floor(index / 28)).padStart(2, "0")}-${String(1 + index % 28).padStart(2, "0")}`, "12")),
      base = rankTemporalShrinkage([{ lotteryId: "x", draws: history }], { weekday: 2, cutoffDate: "2026-02-10", halfLife: 4, priorStrength: 6, minimumWeekdayDraws: 1, minimumAllDaysDraws: 1 }),
      changed = rankTemporalShrinkage([{ lotteryId: "x", draws: [...history, draw("2026-02-10", "99"), draw("2026-02-17", "99")] }], { weekday: 2, cutoffDate: "2026-02-10", halfLife: 4, priorStrength: 6, minimumWeekdayDraws: 1, minimumAllDaysDraws: 1 });
    expect(changed).toEqual(base);
  });

  it("counts a double once per available side", () => {
    const ranking = rankTemporalShrinkage([{ lotteryId: "x", draws: [draw("2026-01-06", "11"), draw("2026-01-13", "11")] }], { weekday: 2, cutoffDate: "2026-01-20", halfLife: "flat", priorStrength: 2, minimumWeekdayDraws: 1, minimumAllDaysDraws: 1 });
    expect(ranking[0].digit).toBe("1");
    expect(ranking[0].score).toBeLessThanOrEqual(1);
  });
});
