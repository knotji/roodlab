import { describe, expect, it } from "vitest";
import { computeHistoryVersion, type Snapshot } from "../cache";
import type { LotteryDefinition, LotteryDraw } from "../types";
import { getGlobalDailyEligibility, resolveGlobalDailySources } from "./global-daily-eligibility";
import { drawWeekday } from "./day-pattern";

const definition = (id: string): LotteryDefinition => ({ id, slug: id, name: `Lottery ${id}`, category: "test", sourceUrl: `https://example.com/${id}`, isActive: true });
const draw = (lotteryId: string, drawDate: string, values: Partial<LotteryDraw> = {}): LotteryDraw => ({ id: `${lotteryId}-${drawDate}`, lotteryId, drawDate, top3: "007", top2: "07", bottom2: "00", completeness: "complete", ...values });
const snapshot = (lotteryId: string, draws: LotteryDraw[], freshness: Snapshot["freshness"] = undefined, providerResultStatus: Snapshot["providerResultStatus"] = undefined): Snapshot => ({ lotteryId, draws, source: "AllHuay", syncedAt: "2026-09-04T00:00:00.000Z", lastSuccessfulSyncAt: "2026-09-04T00:00:00.000Z", historyVersion: computeHistoryVersion(lotteryId, draws), drawCount: draws.length, latestCompleteDrawDate: draws[0]?.drawDate ?? null, ...(freshness ? { freshness } : {}), ...(providerResultStatus ? { providerResultStatus } : {}) });

describe("Global Daily dynamic eligibility", () => {
  const targetDate = "2026-09-08", weekday = drawWeekday(targetDate) as 0 | 1 | 2 | 3 | 4 | 5 | 6;

  it("accepts complete pre-target same-weekday history and preserves leading zeroes", () => {
    const history = [draw("alpha", "2026-09-01")], result = getGlobalDailyEligibility({ lottery: definition("alpha"), snapshot: snapshot("alpha", history), targetDate, weekday, historical: true });
    expect(history[0].top2).toBe("07");
    expect(history[0].bottom2).toBe("00");
    expect(result).toMatchObject({ eligible: true, sameWeekdayHistoryCount: 1 });
  });

  it("excludes missing, partial-only, invalid, and insufficient histories deterministically", () => {
    expect(getGlobalDailyEligibility({ lottery: definition("missing"), targetDate, weekday, historical: true }).reasons).toEqual(["missing-history", "insufficient-same-weekday-history"]);
    const partial = draw("partial", "2026-09-01", { top3: undefined, completeness: "partial" });
    expect(getGlobalDailyEligibility({ lottery: definition("partial"), snapshot: snapshot("partial", [partial]), targetDate, weekday, historical: true }).reasons).toEqual(["no-complete-history", "insufficient-same-weekday-history"]);
    const wrongDay = draw("wrong", "2026-09-02");
    expect(getGlobalDailyEligibility({ lottery: definition("wrong"), snapshot: snapshot("wrong", [wrongDay]), targetDate, weekday, historical: true }).reasons).toEqual(["insufficient-same-weekday-history"]);
    const invalid = draw("invalid", "2026-09-00");
    expect(getGlobalDailyEligibility({ lottery: definition("invalid"), snapshot: snapshot("invalid", [invalid]), targetDate, weekday, historical: true }).reasons).toContain("invalid-history");
  });

  it("never uses target/future draws and historical eligibility ignores current freshness", () => {
    const freshness = { currentDate: "2026-09-04", sourceLatestDrawDate: "2026-09-04", cachedLatestDrawDate: "2026-09-03", checkedAt: "2026-09-04T00:00:00.000Z", status: "cache-behind" as const };
    const draws = [draw("alpha", targetDate), draw("alpha", "2026-09-15"), draw("alpha", "2026-09-01")];
    expect(getGlobalDailyEligibility({ lottery: definition("alpha"), snapshot: snapshot("alpha", draws, freshness), targetDate, weekday, historical: true }).eligible).toBe(true);
    expect(getGlobalDailyEligibility({ lottery: definition("alpha"), snapshot: snapshot("alpha", draws, freshness), targetDate, weekday }).reasons).toContain("known-stale");
  });

  it("excludes current explicit suspension but never applies it retroactively", () => {
    const complete = draw("alpha", "2026-09-01"), suspendedRow = draw("alpha", "2026-09-03", { top3: undefined, top2: undefined, bottom2: undefined, completeness: "partial", providerResultStatus: "suspended", providerStatusRaw: "งด" }), current = snapshot("alpha", [suspendedRow, complete], undefined, "suspended");
    const currentResult = getGlobalDailyEligibility({ lottery: definition("alpha"), snapshot: current, targetDate, weekday });
    expect(currentResult.reasons).toContain("provider-results-suspended");
    expect(currentResult.eligible).toBe(false);
    expect(getGlobalDailyEligibility({ lottery: definition("alpha"), snapshot: current, targetDate, weekday, historical: true })).toMatchObject({ eligible: true, reasons: [] });
  });

  it("does not confuse partial history, calendar age, or unknown status with suspension", () => {
    const complete = draw("alpha", "2026-09-01"), partial = draw("alpha", "2026-09-03", { bottom2: undefined, completeness: "partial", providerResultStatus: "unknown" });
    expect(getGlobalDailyEligibility({ lottery: definition("alpha"), snapshot: snapshot("alpha", [partial, complete], undefined, "unknown"), targetDate, weekday }).reasons).not.toContain("provider-results-suspended");
    expect(getGlobalDailyEligibility({ lottery: definition("old"), snapshot: snapshot("old", [draw("old", "2026-06-02")], undefined, "normal"), targetDate, weekday }).reasons).not.toContain("provider-results-suspended");
  });

  it("includes every eligible canonical ID exactly once without the static pool", () => {
    const catalog = [definition("outside-old-pool"), definition("eligible"), definition("missing")], snapshots = {
      "outside-old-pool": snapshot("outside-old-pool", [draw("outside-old-pool", "2026-09-01")]),
      eligible: snapshot("eligible", [draw("eligible", "2026-09-01")]),
    };
    const result = resolveGlobalDailySources({ catalog, snapshots, targetDate, weekday, historical: true });
    expect(result.sources.map((item) => item.lotteryId)).toEqual(["outside-old-pool", "eligible"]);
  });

  it("gives a suspended history-eligible source zero current contribution", () => {
    const catalog = [definition("normal"), definition("suspended")], snapshots = {
      normal: snapshot("normal", [draw("normal", "2026-09-01")], undefined, "normal"),
      suspended: snapshot("suspended", [draw("suspended", "2026-09-01")], undefined, "suspended"),
    }, result = resolveGlobalDailySources({ catalog, snapshots, targetDate, weekday });
    expect(result.sources.map((item) => item.lotteryId)).toEqual(["normal"]);
    expect(result.eligibility.find((item) => item.lotteryId === "suspended")?.reasons).toEqual(["provider-results-suspended"]);
  });
});
