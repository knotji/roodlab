import { currentBangkokDateKey, currentBangkokWeekday } from "@/lib/analysis/day-pattern";
import { buildGlobalWeekdayWin, type GlobalWeekdayWinResult } from "@/lib/analysis/global-weekday-win";
import { readAllSnapshots } from "@/lib/cache";
import { curatedGlobalSources } from "@/lib/analysis/global-daily-sources";

const CACHE_MS = 5 * 60 * 1000;
let cached: { dateKey: string; expiresAt: number; result: GlobalWeekdayWinResult } | null = null;

export async function GET() {
  try {
    const dateKey = currentBangkokDateKey();
    if (cached && cached.dateKey === dateKey && cached.expiresAt > Date.now())
      return Response.json({ ok: true, ...cached.result });

    const snapshots = curatedGlobalSources(Object.values(await readAllSnapshots())),
      result = buildGlobalWeekdayWin(snapshots, {
        weekday: currentBangkokWeekday(),
        cutoffDate: dateKey,
      });
    cached = { dateKey, expiresAt: Date.now() + CACHE_MS, result };
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "คำนวณวินรวมทุกหวยไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
