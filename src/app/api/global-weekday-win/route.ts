import { currentBangkokDateKey, currentBangkokWeekday } from "@/lib/analysis/day-pattern";
import { buildDailyGlobalComparison } from "@/lib/analysis/daily-global-targets";
import { exclusionReasonCounts } from "@/lib/analysis/global-daily-eligibility";
import { readAllSnapshots, readCatalog, readCatalogAudit } from "@/lib/cache";
import { authorizeDailyLock, createDailyGlobalLock, pairedPreview, previewFingerprint, readDailyGlobalLock, signPreview, validateDailyLock } from "@/lib/daily-global-lock";
import { hasDatabase } from "@/lib/database";
import { buildPrelockSyncPlan } from "@/lib/prelock-sync";
import { readLatestPrelockSyncRun } from "@/lib/prelock-sync-storage";

type RequestedUniverse = "locked" | "today";

async function payload(requestedUniverse: RequestedUniverse) {
  const dateKey = currentBangkokDateKey();
  const [catalog, snapshots, audit] = await Promise.all([readCatalog(), readAllSnapshots(), readCatalogAudit()]),
    weekday = currentBangkokWeekday(), comparison = buildDailyGlobalComparison({ catalog, snapshots, audit, targetDate: dateKey, weekday }),
    selected = requestedUniverse === "today" ? comparison.modes.today_eligible : comparison.modes.locked,
    lock = await readDailyGlobalLock(dateKey),
    syncRun = hasDatabase() ? await readLatestPrelockSyncRun(dateKey).catch(()=>null) : null,
    preview = pairedPreview({targetDate:dateKey,weekday,plan:comparison.lockPlan,targets:comparison.targets,a:comparison.modes.locked,b:comparison.modes.today_eligible,versions:Object.fromEntries(Object.entries(snapshots).map(([id,snapshot])=>[id,snapshot.historyVersion]))}),
    fingerprint = previewFingerprint(preview), signature = signPreview(fingerprint),
    response = {
      ...selected.result,
      eligibility: {
        totalCatalog: catalog.length,
        historiesAvailable: Object.keys(snapshots).length,
        eligible: selected.eligibleCount,
        excluded: selected.configuredCount - selected.eligibleCount,
        exclusionReasons: exclusionReasonCounts(selected.eligibility),
        latestSyncTimestamp: selected.contributorIds.map((id) => snapshots[id]?.syncedAt).filter(Boolean).sort().at(-1) ?? null,
      },
      universe: { mode: selected.mode, weekday, configuredCount: selected.configuredCount, eligibleCount: selected.eligibleCount },
      dailyScope: {
        targetDate: dateKey,
        targetCount: comparison.targetCount,
        historicalTargetCount: comparison.historicalTargetCount,
        targets: comparison.targets,
        scheduleLimitations: comparison.scheduleLimitations,
        sourceExclusions: selected.eligibility.filter((item) => !item.eligible),
        lockPlan: comparison.lockPlan,
      },
      dailyLock: lock ? { status: "locked", record: lock } : {
        status: validateDailyLock(comparison.lockPlan,new Date()).allowed ? "preview" : "missing-after-deadline",
        persistenceAvailable: hasDatabase(),
        authorizationConfigured: Boolean(process.env.DAILY_LOCK_SECRET),
        previewFingerprint: fingerprint,
        previewSignature: signature,
        pairedPreview: preview,
        prelockSync: syncRun,
        ...validateDailyLock(comparison.lockPlan, new Date()),
      },
    };
  return response;
}

export async function GET(request: Request) {
  try {
    const value = new URL(request.url).searchParams.get("universe"), requested: RequestedUniverse = value === "today" || value === "all" ? "today" : "locked";
    return Response.json({ ok: true, ...await payload(requested) });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "คำนวณวินรวมทุกหวยไม่สำเร็จ" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authorization = authorizeDailyLock(request);
  if (!authorization.ok) return Response.json({ ok: false, error: authorization.error }, { status: authorization.status });
  try {
    const body = await request.json() as { previewFingerprint?:string; previewSignature?:string }, dateKey = currentBangkokDateKey(), existing=await readDailyGlobalLock(dateKey);
    if(existing)return Response.json({ok:true,created:false,record:existing});
    const weekday = currentBangkokWeekday(),
      [catalog, snapshots, audit] = await Promise.all([readCatalog(), readAllSnapshots(), readCatalogAudit()]),
      comparison = buildDailyGlobalComparison({ catalog, snapshots, audit, targetDate: dateKey, weekday }),
      syncPlan = buildPrelockSyncPlan({catalog,snapshots,audit,targetDate:dateKey,weekday}),
      syncRun = hasDatabase() ? await readLatestPrelockSyncRun(dateKey).catch(()=>null) : null,
      preview=pairedPreview({targetDate:dateKey,weekday,plan:comparison.lockPlan,targets:comparison.targets,a:comparison.modes.locked,b:comparison.modes.today_eligible,versions:Object.fromEntries(Object.entries(snapshots).map(([id,snapshot])=>[id,snapshot.historyVersion]))}),
      currentFingerprint=previewFingerprint(preview),currentSignature=signPreview(currentFingerprint);
    if(!syncRun||syncRun.status!=="ready"||JSON.stringify([...syncRun.sourceIds].sort())!==JSON.stringify(syncPlan.sourceIds))
      return Response.json({ok:false,error:"pre-lock sync is not ready for this target date"},{status:409});
    if(!body.previewFingerprint||!body.previewSignature||body.previewFingerprint!==currentFingerprint||body.previewSignature!==currentSignature)
      return Response.json({ok:false,error:"ข้อมูล preview เปลี่ยนแล้ว กรุณาตรวจสอบชุดใหม่ก่อนยืนยัน"},{status:409});
    const result = await createDailyGlobalLock({ preview,previewFingerprint:body.previewFingerprint,previewSignature:body.previewSignature });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ล็อกชุดประจำวันไม่สำเร็จ";
    return Response.json({ ok: false, error: message }, { status: message.includes("deadline") ? 409 : 500 });
  }
}
