import { describe, expect, it, vi, afterEach } from "vitest";
import {
  bangkokCalendarDate,
  buildFreshnessInfo,
  computeFreshnessStatus,
  countNewDraws,
  mergeDrawHistory,
} from "./freshness";
import type { LotteryDraw } from "./types";

const draw = (
  lotteryId: string,
  drawDate: string,
  top3 = "123",
): LotteryDraw => ({
  id: `${lotteryId}-${drawDate}`,
  lotteryId,
  drawDate,
  top3,
  top2: top3.slice(-2),
  bottom2: "45",
});

describe("freshness", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses Bangkok calendar date boundaries", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-26T17:30:00.000Z"));
    expect(bangkokCalendarDate()).toBe("2026-08-27");
  });

  it("classifies cache-behind when source is newer", () => {
    expect(
      computeFreshnessStatus({
        sourceLatestDrawDate: "2026-08-26",
        cachedLatestDrawDate: "2026-08-25",
        sourceReachable: true,
      }),
    ).toBe("cache-behind");
  });

  it("classifies up-to-date when source and cache match", () => {
    expect(
      computeFreshnessStatus({
        sourceLatestDrawDate: "2026-08-25",
        cachedLatestDrawDate: "2026-08-25",
        sourceReachable: true,
      }),
    ).toBe("up-to-date");
  });

  it("classifies source-unreachable separately", () => {
    expect(
      computeFreshnessStatus({
        sourceLatestDrawDate: null,
        cachedLatestDrawDate: "2026-08-25",
        sourceReachable: false,
      }),
    ).toBe("source-unreachable");
  });

  it("merges cache with newer source draws without dropping existing rows", () => {
    const existing = [
      draw("demo", "2026-08-24"),
      draw("demo", "2026-08-23"),
    ];
    const incoming = [
      draw("demo", "2026-08-26"),
      draw("demo", "2026-08-25"),
      draw("demo", "2026-08-24"),
    ];
    const merged = mergeDrawHistory(existing, incoming, 100);
    expect(merged.map((item) => item.drawDate)).toEqual([
      "2026-08-26",
      "2026-08-25",
      "2026-08-24",
      "2026-08-23",
    ]);
    expect(countNewDraws(existing, merged)).toBe(2);
  });

  it("builds freshness metadata with checkedAt timestamp", () => {
    const checkedAt = new Date("2026-08-27T02:00:00.000Z");
    expect(
      buildFreshnessInfo({
        sourceLatestDrawDate: "2026-08-26",
        cachedLatestDrawDate: "2026-08-25",
        sourceReachable: true,
        checkedAt,
      }),
    ).toMatchObject({
      currentDate: "2026-08-27",
      sourceLatestDrawDate: "2026-08-26",
      cachedLatestDrawDate: "2026-08-25",
      status: "cache-behind",
      checkedAt: checkedAt.toISOString(),
    });
  });
});
