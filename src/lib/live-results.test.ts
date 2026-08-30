import { describe, expect, it } from "vitest";
import { LIVE_RESULT_SOURCES, liveResultSource } from "./live-results";

describe("live result sources", () => {
  it("maps known lottery ids to their direct live-result sites", () => {
    expect(liveResultSource("laotv")?.url).toBe("https://lao-tv.com/");
    expect(liveResultSource("minhngocstar")?.resultAt).toBe("12:30");
    expect(liveResultSource("szse-vip-morning")?.url).toBe("https://shenzhenindex.com/");
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
});
