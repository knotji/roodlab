import { NextResponse } from "next/server";
import { currentBangkokDateKey, drawWeekday } from "@/lib/analysis/day-pattern";
import { buildDailyGlobalComparison } from "@/lib/analysis/daily-global-targets";
import type { PlayedUniverseWeekday } from "@/lib/analysis/played-universe";
import { readAllSnapshots, readCatalog, readCatalogAudit } from "@/lib/cache";
import { cronAuthorizationStatus } from "@/lib/cron-auth";
import { hasDatabase } from "@/lib/database";
import { executePrelockSync, buildPrelockSyncPlan } from "@/lib/prelock-sync";
import { postgresPrelockSyncRunStore, readLatestPrelockSyncRun } from "@/lib/prelock-sync-storage";
import { syncLotteryFromSource } from "@/lib/sync-service";

// Hobby functions are capped at 60 seconds. The source union is processed in
// bounded batches so this route remains portable to the current Vercel plan.
export const maxDuration = 60;

function authorizationResponse(request: Request) {
  const status = cronAuthorizationStatus(request.headers.get("authorization"));
  if (status === "missing-secret") return NextResponse.json({ ok:false,error:"CRON_SECRET is not configured" }, { status:503 });
  if (status === "unauthorized") return NextResponse.json({ ok:false,error:"Unauthorized" }, { status:401 });
  return null;
}

function nextDate(date: string) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

async function prepare(targetDate: string) {
  try {
    const today = currentBangkokDateKey();
    if (targetDate < today || targetDate > nextDate(today)) return NextResponse.json({ok:false,error:"targetDate must be today or tomorrow in Asia/Bangkok"},{status:400});
    const weekday = drawWeekday(targetDate) as PlayedUniverseWeekday, [catalog,snapshots,audit] = await Promise.all([readCatalog(),readAllSnapshots(),readCatalogAudit()]),
      plan = buildPrelockSyncPlan({catalog,snapshots,audit,targetDate,weekday});
    if (!plan.deadlineBangkok || !plan.exactDeadlineKnown) return NextResponse.json({ok:false,error:"daily lock deadline is not verified",plan},{status:409});
    if (Date.now() >= new Date(plan.deadlineBangkok).getTime()) return NextResponse.json({ok:false,error:"daily lock deadline has passed",plan},{status:409});
    const result = await executePrelockSync({
      plan,store:postgresPrelockSyncRunStore,syncOne:(lotteryId)=>syncLotteryFromSource(lotteryId,{reconcileProspective:false}),
      evaluateReadiness:async()=>{
        const refreshed=await readAllSnapshots(),comparison=buildDailyGlobalComparison({catalog,snapshots:refreshed,audit,targetDate,weekday});
        return {ready:comparison.modes.locked.result.sufficient&&comparison.modes.today_eligible.result.sufficient,
          a:{configured:comparison.modes.locked.configuredCount,eligible:comparison.modes.locked.eligibleCount,sufficient:comparison.modes.locked.result.sufficient,exclusions:comparison.modes.locked.eligibility.filter(x=>!x.eligible)},
          b:{configured:comparison.modes.today_eligible.configuredCount,eligible:comparison.modes.today_eligible.eligibleCount,sufficient:comparison.modes.today_eligible.result.sufficient,exclusions:comparison.targetSourceExclusions},
          scheduleLimitations:comparison.scheduleLimitations};
      },
    });
    return NextResponse.json({ok:true,...result});
  } catch(error) {
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:"pre-lock sync failed"},{status:500});
  }
}

// Vercel Cron invokes configured paths with GET. `status=1` keeps an
// authenticated read-only inspection path without making the scheduled call a
// no-op.
export async function GET(request: Request) {
  const denied = authorizationResponse(request);
  if (denied) return denied;
  if (!hasDatabase()) return NextResponse.json({ ok:false,error:"DATABASE_URL is not configured" }, { status:503 });
  const url = new URL(request.url);
  if (url.searchParams.get("status") === "1") {
    const targetDate = url.searchParams.get("date") ?? nextDate(currentBangkokDateKey());
    return NextResponse.json({ ok:true,run:await readLatestPrelockSyncRun(targetDate) });
  }
  return prepare(nextDate(currentBangkokDateKey()));
}

export async function POST(request: Request) {
  const denied = authorizationResponse(request);
  if (denied) return denied;
  if (!hasDatabase()) return NextResponse.json({ ok:false,error:"DATABASE_URL is not configured" }, { status:503 });
  const body = await request.json().catch(() => ({})) as { targetDate?:string };
  return prepare(body.targetDate ?? nextDate(currentBangkokDateKey()));
}
