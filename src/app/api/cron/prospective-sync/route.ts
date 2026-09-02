import { NextResponse } from "next/server";
import { pendingDueLotteryIds } from "@/lib/prospective";
import { syncLotteryFromSource } from "@/lib/sync-service";
import { cronAuthorizationStatus } from "@/lib/cron-auth";
import { buildNightlySyncBatch } from "@/lib/nightly-sync";

export const maxDuration = 120;

export async function GET(request: Request) {
  const authorization = cronAuthorizationStatus(request.headers.get("authorization"));
  if (authorization === "missing-secret") return NextResponse.json({ ok: false, error: "CRON_SECRET is not configured" }, { status: 503 });
  if (authorization === "unauthorized")
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const due = await pendingDueLotteryIds(10), batch = await buildNightlySyncBatch(due, 12), lotteryIds = batch.ids,
    results: { lotteryId: string; ok: boolean; addedDraws?: number; reconciledPredictions?: number; error?: string }[] = [];
  for (const lotteryId of lotteryIds) {
    try {
      const result = await syncLotteryFromSource(lotteryId);
      results.push({ lotteryId, ok: true, addedDraws: result.addedDraws, reconciledPredictions: result.reconciledPredictions });
    } catch (error) {
      results.push({ lotteryId, ok: false, error: error instanceof Error ? error.message : "sync failed" });
    }
  }
  return NextResponse.json({ ok: true, checked: lotteryIds.length, eligible: batch.eligibleCount, due: batch.dueCount, results });
}
