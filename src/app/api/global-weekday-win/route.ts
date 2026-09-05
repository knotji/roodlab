import { currentBangkokDateKey, currentBangkokWeekday } from "@/lib/analysis/day-pattern";
import type { GlobalWeekdayWinResult } from "@/lib/analysis/global-weekday-win";
import { exclusionReasonCounts } from "@/lib/analysis/global-daily-eligibility";
import { buildProductionGlobalWeekdayWin } from "@/lib/analysis/global-universe";
import { readAllSnapshots, readCatalog, readCatalogAudit } from "@/lib/cache";

const CACHE_MS = 5 * 60 * 1000;
let cached: { dateKey: string; expiresAt: number; result: GlobalWeekdayWinResult } | null = null;

export async function GET() {
  try {
    const dateKey = currentBangkokDateKey();
    if (cached && cached.dateKey === dateKey && cached.expiresAt > Date.now())
      return Response.json({ ok: true, ...cached.result });

    const [catalog, snapshots, audit] = await Promise.all([readCatalog(), readAllSnapshots(), readCatalogAudit()]),
      { universe, result } = buildProductionGlobalWeekdayWin({ catalog, snapshots, audit, targetDate: dateKey, weekday: currentBangkokWeekday() }),
      response = {
        ...result,
        eligibility: {
          totalCatalog: catalog.length,
          historiesAvailable: Object.keys(snapshots).length,
          eligible: universe.eligibleCount,
          excluded: universe.configuredCount - universe.eligibleCount,
          exclusionReasons: exclusionReasonCounts(universe.eligibility),
          latestSyncTimestamp: universe.sources.map((source) => source.syncedAt).sort().at(-1) ?? null,
        },
        universe: {
          mode: universe.mode,
          weekday: universe.weekday,
          configuredCount: universe.configuredCount,
          eligibleCount: universe.eligibleCount,
        },
      };
    cached = { dateKey, expiresAt: Date.now() + CACHE_MS, result: response };
    return Response.json({ ok: true, ...response });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "คำนวณวินรวมทุกหวยไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
