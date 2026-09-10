import { currentBangkokDateKey, currentBangkokWeekday } from "@/lib/analysis/day-pattern";
import type { GlobalWeekdayWinResult } from "@/lib/analysis/global-weekday-win";
import { exclusionReasonCounts } from "@/lib/analysis/global-daily-eligibility";
import { buildGlobalWeekdayWinForUniverse, buildProductionGlobalWeekdayWin } from "@/lib/analysis/global-universe";
import { readAllSnapshots, readCatalog, readCatalogAudit } from "@/lib/cache";

const CACHE_MS = 5 * 60 * 1000;
type RequestedUniverse = "locked" | "all";
type CachedResult = GlobalWeekdayWinResult & {
  universe: { mode: "played" | "all_eligible_fallback" | "all_eligible"; weekday: number; configuredCount: number; eligibleCount: number };
};
const cache = new Map<RequestedUniverse, { dateKey: string; expiresAt: number; result: CachedResult }>();

export async function GET(request: Request) {
  try {
    const requestedUniverse: RequestedUniverse = new URL(request.url).searchParams.get("universe") === "all" ? "all" : "locked",
      dateKey = currentBangkokDateKey(),
      cached = cache.get(requestedUniverse);
    if (cached && cached.dateKey === dateKey && cached.expiresAt > Date.now()) return Response.json({ ok: true, ...cached.result });

    const [catalog, snapshots, audit] = await Promise.all([readCatalog(), readAllSnapshots(), readCatalogAudit()]),
      weekday = currentBangkokWeekday();
    let result: GlobalWeekdayWinResult,
      universe: CachedResult["universe"],
      eligibility: ReturnType<typeof buildGlobalWeekdayWinForUniverse>["eligibility"],
      latestSyncTimestamp: string | null;
    if (requestedUniverse === "all") {
      const resolved = buildGlobalWeekdayWinForUniverse({ mode: "all_eligible", catalog, snapshots, audit, targetDate: dateKey, weekday });
      result = resolved.result;
      eligibility = resolved.eligibility;
      universe = { mode: "all_eligible", weekday, configuredCount: resolved.universeCatalogSize, eligibleCount: resolved.eligibilitySummary.eligible };
      latestSyncTimestamp = Object.values(snapshots).map((source) => source.syncedAt).filter(Boolean).sort().at(-1) ?? null;
    } else {
      const resolved = buildProductionGlobalWeekdayWin({ catalog, snapshots, audit, targetDate: dateKey, weekday });
      result = resolved.result;
      eligibility = resolved.universe.eligibility;
      universe = { mode: resolved.universe.mode, weekday, configuredCount: resolved.universe.configuredCount, eligibleCount: resolved.universe.eligibleCount };
      latestSyncTimestamp = resolved.universe.sources.map((source) => source.syncedAt).sort().at(-1) ?? null;
    }
    const response = {
        ...result,
        eligibility: {
          totalCatalog: catalog.length,
          historiesAvailable: Object.keys(snapshots).length,
          eligible: universe.eligibleCount,
          excluded: universe.configuredCount - universe.eligibleCount,
          exclusionReasons: exclusionReasonCounts(eligibility),
          latestSyncTimestamp,
        },
        universe: {
          mode: universe.mode,
          weekday: universe.weekday,
          configuredCount: universe.configuredCount,
          eligibleCount: universe.eligibleCount,
        },
      };
    cache.set(requestedUniverse, { dateKey, expiresAt: Date.now() + CACHE_MS, result: response });
    return Response.json({ ok: true, ...response });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "คำนวณวินรวมทุกหวยไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
