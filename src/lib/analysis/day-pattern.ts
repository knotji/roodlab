import type { LotteryDraw } from "../types";

export type DayPattern = "all" | 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DAY_PATTERN_OPTIONS: readonly {
  value: DayPattern;
  shortLabel: string;
  label: string;
}[] = [
  { value: "all", shortLabel: "ทุกวัน", label: "ทุกวันออกรางวัล" },
  { value: 1, shortLabel: "จ.", label: "วันจันทร์" },
  { value: 2, shortLabel: "อ.", label: "วันอังคาร" },
  { value: 3, shortLabel: "พ.", label: "วันพุธ" },
  { value: 4, shortLabel: "พฤ.", label: "วันพฤหัสบดี" },
  { value: 5, shortLabel: "ศ.", label: "วันศุกร์" },
  { value: 6, shortLabel: "ส.", label: "วันเสาร์" },
  { value: 0, shortLabel: "อา.", label: "วันอาทิตย์" },
];

export const MIN_DAY_PATTERN_DRAWS = 10;

export function drawWeekday(drawDate: string) {
  return new Date(`${drawDate}T12:00:00.000Z`).getUTCDay();
}

export function filterDrawsByDay(
  draws: LotteryDraw[],
  dayPattern: DayPattern,
) {
  return dayPattern === "all"
    ? draws
    : draws.filter((draw) => drawWeekday(draw.drawDate) === dayPattern);
}

export function dayPatternLabel(dayPattern: DayPattern) {
  return (
    DAY_PATTERN_OPTIONS.find((option) => option.value === dayPattern)?.label ??
    "ทุกวันออกรางวัล"
  );
}
