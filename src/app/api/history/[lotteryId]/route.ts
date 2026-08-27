import { NextResponse } from "next/server";
import { AllHuayDataSource } from "@/lib/data-sources/allhuay";
import { buildFreshnessInfo, latestDrawDate, mergeDrawHistory } from "@/lib/freshness";
import { readCatalog, readSnapshot } from "@/lib/cache";
import { CanonicalSyncError, commitCanonicalSync } from "@/lib/canonical-history";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ lotteryId: string }> },
) {
  const { lotteryId } = await params;
  const snapshot = await readSnapshot(lotteryId);
  return snapshot
    ? NextResponse.json({ ok: true, ...snapshot })
    : NextResponse.json(
        { ok: false, error: "ยังไม่มีข้อมูลสำหรับหวยนี้" },
        { status: 404 },
      );
}

export async function POST(
  _: Request,
  { params }: { params: Promise<{ lotteryId: string }> },
) {
  const { lotteryId } = await params;
  try {
    const existing = await readSnapshot(lotteryId);
    const incoming = await new AllHuayDataSource(await readCatalog()).getCanonicalHistory(
      lotteryId,
      { limit: 100 },
    );
    const freshness = buildFreshnessInfo({
      sourceLatestDrawDate: incoming.currentSourceResultDate ?? latestDrawDate(incoming.draws),
      cachedLatestDrawDate: latestDrawDate(mergeDrawHistory(existing?.draws ?? [], incoming.draws, 100)),
      sourceReachable: true,
    });
    const {snapshot,outcome,addedDraws}=await commitCanonicalSync({lotteryId,existing,incoming,freshness});
    return NextResponse.json({
      ok: true,
      ...snapshot,
      addedDraws,
      syncOutcome: outcome,
      message: outcome === "updated" ? "อัปเดตแล้ว" : "ข้อมูลเป็นปัจจุบันแล้ว",
      sourceLatestDrawDate: freshness.sourceLatestDrawDate,
      cachedLatestDrawDate: freshness.cachedLatestDrawDate,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "ซิงก์ไม่สำเร็จ",
        syncOutcome: error instanceof CanonicalSyncError ? error.outcome : "write-failure",
        cachePreserved: true,
      },
      { status: 502 },
    );
  }
}
