import { NextResponse } from "next/server";
import { readSnapshot } from "@/lib/cache";
import { CanonicalSyncError } from "@/lib/canonical-history";
import { guardWrite } from "@/lib/write-guard";
import { syncLotteryFromSource } from "@/lib/sync-service";

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
  request: Request,
  { params }: { params: Promise<{ lotteryId: string }> },
) {
  const { lotteryId } = await params;
  const guard = await guardWrite(request, `history:${lotteryId}`, 30);
  if (!guard.ok) {
    return NextResponse.json(
      { ok: false, error: guard.error },
      { status: guard.status },
    );
  }
  try {
    const {snapshot,outcome,addedDraws,freshness,reconciledPredictions}=await syncLotteryFromSource(lotteryId);
    return NextResponse.json({
      ok: true,
      ...snapshot,
      addedDraws,
      reconciledPredictions,
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
