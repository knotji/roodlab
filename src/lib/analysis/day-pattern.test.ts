import { describe, expect, it } from "vitest";
import type { LotteryDraw } from "../types";
import {
  dayPatternLabel,
  currentBangkokDateKey,
  currentBangkokWeekday,
  drawWeekday,
  filterDrawsByDay,
} from "./day-pattern";

const draw = (drawDate: string): LotteryDraw => ({
  id: drawDate,
  lotteryId: "demo",
  drawDate,
  top3: "123",
  top2: "23",
  bottom2: "45",
});

describe("day pattern", () => {
  it("derives weekdays without depending on the browser locale", () => {
    expect(drawWeekday("2026-08-24")).toBe(1);
    expect(drawWeekday("2026-08-30")).toBe(0);
  });

  it("filters only matching historical draw days", () => {
    const draws = [draw("2026-08-24"), draw("2026-08-25"), draw("2026-08-31")];
    expect(filterDrawsByDay(draws, 1).map((item) => item.drawDate)).toEqual([
      "2026-08-24",
      "2026-08-31",
    ]);
    expect(filterDrawsByDay(draws, "all")).toBe(draws);
  });

  it("provides a user-facing Thai label", () => {
    expect(dayPatternLabel(3)).toBe("วันพุธ");
  });

  it("derives the current weekday from the Bangkok calendar date", () => {
    expect(currentBangkokWeekday(new Date("2026-08-29T18:00:00.000Z"))).toBe(0);
    expect(currentBangkokDateKey(new Date("2026-08-31T18:00:00.000Z"))).toBe("2026-09-01");
  });
});
