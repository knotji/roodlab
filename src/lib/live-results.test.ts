import { describe, expect, it } from "vitest";
import { LIVE_RESULT_SOURCES, liveResultSource } from "./live-results";

describe("live result sources", () => {
  it("maps known lottery ids to their direct live-result sites", () => {
    expect(liveResultSource("laotv")?.url).toBe("https://lao-tv.com/");
    expect(liveResultSource("minhngocstar")?.resultAt).toBe("12:30");
    expect(liveResultSource("szse-vip-morning")?.url).toBe("https://shenzhenindex.com/");
    expect(liveResultSource("nikkei-morning")?.resultAt).toBe("09:30");
    expect(liveResultSource("nikkei-afternoon")?.resultAt).toBe("13:00");
    expect(liveResultSource("szse-morning")?.resultAt).toBe("10:30");
    expect(liveResultSource("szse-afternoon")?.resultAt).toBe("14:00");
    expect(liveResultSource("hsi-morning")?.resultAt).toBe("11:00");
    expect(liveResultSource("hsi-afternoon")?.resultAt).toBe("15:00");
    expect(liveResultSource("twse")?.resultAt).toBe("12:35");
    expect(liveResultSource("ktop30")?.resultAt).toBe("13:35");
  });

  it("does not guess a source for an unmapped lottery", () => {
    expect(liveResultSource("unknown-lottery")).toBeNull();
  });

  it("keeps every configured source as an explicit web URL", () => {
    for (const source of Object.values(LIVE_RESULT_SOURCES)) {
      expect(() => new URL(source.url)).not.toThrow();
      const backupUrl = source.backupUrl;
      if (backupUrl) expect(() => new URL(backupUrl)).not.toThrow();
    }
  });

  it("marks standard market schedules as weekdays without restricting daily lotteries", () => {
    expect(liveResultSource("nikkei-morning")?.weekdays).toEqual([1, 2, 3, 4, 5]);
    expect(liveResultSource("laotv")?.weekdays).toBeUndefined();
  });
});
