import { currentBangkokDateKey, currentBangkokWeekday } from "@/lib/analysis/day-pattern";
import { buildGlobalWeekdayWin, type GlobalWeekdayWinResult } from "@/lib/analysis/global-weekday-win";
import { exclusionReasonCounts, resolveGlobalDailySources } from "@/lib/analysis/global-daily-eligibility";
import { readAllSnapshots, readCatalog, readCatalogAudit } from "@/lib/cache";

const CACHE_MS = 5 * 60 * 1000;
let cached: { dateKey: string; expiresAt: number; result: GlobalWeekdayWinResult } | null = null;

export async function GET() {
  try {
    const dateKey = currentBangkokDateKey();
    if (cached && cached.dateKey === dateKey && cached.expiresAt > Date.now())
      return Response.json({ ok: true, ...cached.result });

    const [catalog, snapshots, audit] = await Promise.all([readCatalog(), readAllSnapshots(), readCatalogAudit()]),
      resolved = resolveGlobalDailySources({ catalog, snapshots, audit, targetDate: dateKey, weekday: currentBangkokWeekday() }),
      result = buildGlobalWeekdayWin(resolved.sources, {
        weekday: currentBangkokWeekday(),
        cutoffDate: dateKey,
      }), response = { ...result, eligibility: { totalCatalog: catalog.length, historiesAvailable: Object.keys(snapshots).length, eligible: resolved.sources.length, excluded: catalog.length - resolved.sources.length, exclusionReasons: exclusionReasonCounts(resolved.eligibility), latestSyncTimestamp: resolved.sources.map((source) => source.syncedAt).sort().at(-1) ?? null } };
    cached = { dateKey, expiresAt: Date.now() + CACHE_MS, result: response };
    return Response.json({ ok: true, ...response });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "คำนวณวินรวมทุกหวยไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
