import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { pendingDueLotteryIds } from "@/lib/prospective";
import { syncLotteryFromSource } from "@/lib/sync-service";
import { cronAuthorizationStatus } from "@/lib/cron-auth";
import { buildNightlySyncBatch } from "@/lib/nightly-sync";
import { hasDatabase } from "@/lib/database";
import { postgresNightlySyncRunStore, readLatestNightlySyncRun, type NightlySyncRun } from "@/lib/nightly-sync-storage";

export const maxDuration = 120;

export async function GET(request: Request) {
  const authorization = cronAuthorizationStatus(request.headers.get("authorization"));
  if (authorization === "missing-secret") return NextResponse.json({ ok: false, error: "CRON_SECRET is not configured" }, { status: 503 });
  if (authorization === "unauthorized")
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  if (new URL(request.url).searchParams.get("status") === "1") {
    if (!hasDatabase()) return NextResponse.json({ ok: false, error: "DATABASE_URL is not configured" }, { status: 503 });
    return NextResponse.json({ ok: true, run: await readLatestNightlySyncRun() });
  }

  const due = await pendingDueLotteryIds(10), batch = await buildNightlySyncBatch(due, 12), lotteryIds = batch.ids,
    results: { lotteryId: string; ok: boolean; addedDraws?: number; reconciledPredictions?: number; error?: string }[] = [];

  // The run ledger is best-effort observability only: a missing database or a failed
  // ledger write must never block or alter the actual sync, which is the load-bearing behavior.
  const persistLedger = hasDatabase(),
    run: NightlySyncRun | null = persistLedger
      ? { id: randomUUID(), startedAt: new Date().toISOString(), completedAt: null, checkedCount: lotteryIds.length, eligibleCount: batch.eligibleCount, dueCount: batch.dueCount, successCount: 0, failedCount: 0 }
      : null;
  if (run) await postgresNightlySyncRunStore.create(run).catch(() => {});

  for (const lotteryId of lotteryIds) {
    try {
      const result = await syncLotteryFromSource(lotteryId);
      results.push({ lotteryId, ok: true, addedDraws: result.addedDraws, reconciledPredictions: result.reconciledPredictions });
      if (run) await postgresNightlySyncRunStore.recordItem({ runId: run.id, lotteryId, ok: true, addedDraws: result.addedDraws, reconciledPredictions: result.reconciledPredictions, errorMessage: null, completedAt: new Date().toISOString() }).catch(() => {});
    } catch (error) {
      const message = error instanceof Error ? error.message : "sync failed";
      results.push({ lotteryId, ok: false, error: message });
      if (run) await postgresNightlySyncRunStore.recordItem({ runId: run.id, lotteryId, ok: false, addedDraws: null, reconciledPredictions: null, errorMessage: message, completedAt: new Date().toISOString() }).catch(() => {});
    }
  }

  if (run) {
    const successCount = results.filter((item) => item.ok).length;
    await postgresNightlySyncRunStore.finish({ ...run, completedAt: new Date().toISOString(), successCount, failedCount: results.length - successCount }).catch(() => {});
  }

  return NextResponse.json({ ok: true, checked: lotteryIds.length, eligible: batch.eligibleCount, due: batch.dueCount, results });
}
