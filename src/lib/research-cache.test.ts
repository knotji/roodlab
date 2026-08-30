import { describe, expect, it } from "vitest";
import { readResearchCache, writeResearchCache } from "./research-cache";

describe("research report cache", () => {
  it("reuses a report under its history-version key", () => {
    const key = "pair-report:test-history-version";
    const report = { ok: true, rows: [1, 2, 3] };
    expect(readResearchCache(key)).toBeNull();
    writeResearchCache(key, report);
    expect(readResearchCache(key)).toBe(report);
  });
});
