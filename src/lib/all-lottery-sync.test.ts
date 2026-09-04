import { describe, expect, it, vi } from "vitest";
import { computeHistoryVersion, type Snapshot } from "./cache";
import { runBounded, syncAllLotteries } from "./all-lottery-sync";
import type { LotteryDefinition, LotteryDraw } from "./types";

describe("all-lottery sync concurrency", () => {
  it("bounds parallel work and isolates one task failure when the task handles it", async () => {
    let active = 0, maximum = 0;
    const results = await runBounded([1, 2, 3, 4, 5], 2, async (value) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      return value === 3 ? "failed" : "ok";
    });
    expect(maximum).toBeLessThanOrEqual(2);
    expect(results.filter((item) => item === "ok")).toHaveLength(4);
    expect(results).toContain("failed");
  });

  it("isolates one source failure and preserves its last-known-good snapshot", async () => {
    const definitions: LotteryDefinition[] = ["a", "b", "c"].map((id) => ({ id, slug: id, name: id, category: "test", sourceUrl: `https://example.com/${id}` })),
      snapshots = Object.fromEntries(definitions.map(({ id }) => {
        const draws: LotteryDraw[] = [{ id: `${id}-old`, lotteryId: id, drawDate: "2026-09-01", top3: "007", top2: "07", bottom2: "00", completeness: "complete" }];
        return [id, { lotteryId: id, source: "AllHuay", syncedAt: "2026-09-01T00:00:00.000Z", draws, historyVersion: computeHistoryVersion(id, draws), providerResultStatus: id === "c" ? "suspended" : "normal" } satisfies Snapshot];
      })), before = snapshots.b.historyVersion,
      syncOne = vi.fn(async (id: string) => {
        if (id === "b") throw new Error("provider timeout");
        return { snapshot: snapshots[id], outcome: "unchanged" as const, addedDraws: 0, freshness: { currentDate: "2026-09-04", sourceLatestDrawDate: "2026-09-01", cachedLatestDrawDate: "2026-09-01", checkedAt: "2026-09-04T00:00:00.000Z", status: "up-to-date" as const }, reconciledPredictions: 0 };
      });
    const result = await syncAllLotteries({ catalog: definitions, audit: {}, retries: 0, concurrency: 2, syncOne, readOne: async (id) => snapshots[id] ?? null, readAll: async () => snapshots });
    expect(result).toMatchObject({ attempted: 3, unchanged: 2, failed: 1, stored: 3, suspended: 1 });
    expect(result.items.find((item) => item.id === "b")).toMatchObject({ outcome: "failed", error: "provider timeout", historyVersion: before });
    expect(syncOne).toHaveBeenCalledWith("a", { reconcileProspective: false });
    expect(result.items.find((item) => item.id === "c")?.outcome).toBe("unchanged");
  });
});
