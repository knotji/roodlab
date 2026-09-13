import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { database, hasDatabase } from "./database";
import type { DailyGlobalModeResult, DailyLockPlan, DailyLotteryTarget } from "./analysis/daily-global-targets";

export const DAILY_GLOBAL_LOCK_FORMULA_VERSION = "weekday-frequency-daily-paired-lock-v2";

export type DailyGlobalLockMode = {
  digits: string[];
  configuredCount: number;
  eligibleCount: number;
  contributorLotteryIds: string[];
  historyVersion: string;
};

export type DailyGlobalLockRecord = {
  id: string;
  targetDate: string;
  weekday: number;
  formulaVersion: string;
  historyVersion: string;
  modes: { a: DailyGlobalLockMode; b: DailyGlobalLockMode };
  targetLotteryIds: string[];
  scheduleLimitations: Array<{ lotteryId: string; issues: string[] }>;
  deadlineBangkok: string;
  createdAt: string;
};

type LockRow = { id: string; target_date: string | Date; weekday: number; formula_version: string; history_version: string; ranked_digits: unknown; source_lottery_ids: unknown; analysis_options: unknown; created_at: string | Date };
export type DailyLockStore = {
  read(targetDate: string, formulaVersion: string): Promise<LockRow | null>;
  insertBeforeDeadline(row: Omit<LockRow, "created_at">, deadlineBangkok: string): Promise<LockRow | null>;
};

function parseRecord(row: LockRow): DailyGlobalLockRecord {
  const digits = row.ranked_digits as { a: string[]; b: string[] }, sources = row.source_lottery_ids as { a: string[]; b: string[] },
    options = row.analysis_options as Omit<DailyGlobalLockRecord, "id" | "targetDate" | "weekday" | "formulaVersion" | "historyVersion" | "modes" | "createdAt"> & { modes: { a: Omit<DailyGlobalLockMode,"digits"|"contributorLotteryIds">; b: Omit<DailyGlobalLockMode,"digits"|"contributorLotteryIds"> } };
  return {
    id: row.id, targetDate: row.target_date instanceof Date ? row.target_date.toISOString().slice(0,10) : String(row.target_date).slice(0,10), weekday: row.weekday,
    formulaVersion: row.formula_version, historyVersion: row.history_version,
    modes: {
      a: { ...options.modes.a, digits: digits.a, contributorLotteryIds: sources.a },
      b: { ...options.modes.b, digits: digits.b, contributorLotteryIds: sources.b },
    },
    targetLotteryIds: options.targetLotteryIds, scheduleLimitations: options.scheduleLimitations,
    deadlineBangkok: options.deadlineBangkok,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

function neonStore(): DailyLockStore {
  return {
    async read(targetDate, formulaVersion) {
      const rows = await database().query(`SELECT * FROM global_prediction_snapshots WHERE target_date=$1::date AND formula_version=$2 LIMIT 1`, [targetDate, formulaVersion]) as LockRow[];
      return rows[0] ?? null;
    },
    async insertBeforeDeadline(row, deadlineBangkok) {
      const rows = await database().query(
        `INSERT INTO global_prediction_snapshots (id,target_date,weekday,formula_version,history_version,ranked_digits,source_lottery_ids,analysis_options)
         SELECT $1,$2::date,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb WHERE now() < $9::timestamptz
         ON CONFLICT (target_date,formula_version) DO NOTHING RETURNING *`,
        [row.id,row.target_date,row.weekday,row.formula_version,row.history_version,JSON.stringify(row.ranked_digits),JSON.stringify(row.source_lottery_ids),JSON.stringify(row.analysis_options),deadlineBangkok],
      ) as LockRow[];
      return rows[0] ?? null;
    },
  };
}

export function combinedHistoryVersion(mode: DailyGlobalModeResult, versions: Record<string, string | undefined>) {
  return createHash("sha256").update(mode.contributorIds.map((id) => `${id}:${versions[id] ?? "missing"}`).sort().join("|")).digest("hex");
}

export function pairedPreview(input: { targetDate: string; weekday: number; plan: DailyLockPlan; targets: DailyLotteryTarget[]; a: DailyGlobalModeResult; b: DailyGlobalModeResult; versions: Record<string,string|undefined> }) {
  const mode = (value: DailyGlobalModeResult): DailyGlobalLockMode => ({ digits:value.result.rankedDigits.slice(0,6).map(x=>x.digit),configuredCount:value.configuredCount,eligibleCount:value.eligibleCount,contributorLotteryIds:value.contributorIds,historyVersion:combinedHistoryVersion(value,input.versions) });
  return { targetDate:input.targetDate,weekday:input.weekday,deadlineBangkok:input.plan.deadlineBangkok,targets:input.targets.map(x=>x.lotteryId),scheduleLimitations:input.targets.filter(x=>x.scheduleIssues.length).map(x=>({lotteryId:x.lotteryId,issues:x.scheduleIssues})),modes:{a:mode(input.a),b:mode(input.b)} };
}

export function previewFingerprint(preview: ReturnType<typeof pairedPreview>) { return createHash("sha256").update(JSON.stringify(preview)).digest("hex"); }
export function signPreview(fingerprint: string) { const secret=process.env.DAILY_LOCK_SIGNING_SECRET ?? process.env.DAILY_LOCK_SECRET; return secret ? createHmac("sha256",secret).update(fingerprint).digest("hex") : null; }
export function authorizeDailyLock(request: Request) {
  const expected=process.env.DAILY_LOCK_SECRET,supplied=request.headers.get("x-daily-lock-secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
  if(!expected) return {ok:false as const,status:503 as const,error:"DAILY_LOCK_SECRET is not configured"};
  if(!supplied) return {ok:false as const,status:401 as const,error:"ต้องยืนยันสิทธิ์ก่อนล็อกชุด"};
  const a=Buffer.from(supplied),b=Buffer.from(expected); return a.length===b.length&&timingSafeEqual(a,b)?{ok:true as const}:{ok:false as const,status:403 as const,error:"สิทธิ์ล็อกชุดไม่ถูกต้อง"};
}
export function validateDailyLock(plan: DailyLockPlan, now: Date) {
  if (!plan.exactDeadlineKnown || !plan.deadlineBangkok) return { allowed:false as const,reason:"lock-deadline-unverified" as const };
  if (now.getTime() >= new Date(plan.deadlineBangkok).getTime()) return { allowed:false as const,reason:"lock-deadline-passed" as const };
  return { allowed:true as const };
}

// Short-lived cache for the real (no injected store) read path only - a lock is
// immutable once created, so the only staleness risk is briefly showing "not
// locked yet" right after one is created, which createDailyGlobalLock clears
// immediately below. Test-injected stores always read fresh.
const LOCK_READ_TTL_MS = 10_000;
const lockReadCache = new Map<string, { value: DailyGlobalLockRecord | null; expiresAt: number }>();

export async function readDailyGlobalLock(targetDate:string, store?:DailyLockStore) {
  if(!store){
    const cached=lockReadCache.get(targetDate);
    if(cached&&cached.expiresAt>Date.now())return cached.value;
  }
  if(!store&&!hasDatabase()) return null;
  const row=await (store??neonStore()).read(targetDate,DAILY_GLOBAL_LOCK_FORMULA_VERSION), record=row?parseRecord(row):null;
  if(!store)lockReadCache.set(targetDate,{value:record,expiresAt:Date.now()+LOCK_READ_TTL_MS});
  return record;
}

export async function createDailyGlobalLock(input:{preview:ReturnType<typeof pairedPreview>;previewFingerprint:string;previewSignature:string;now?:Date;store?:DailyLockStore}) {
  const store=input.store??neonStore(), existing=await readDailyGlobalLock(input.preview.targetDate,store); if(existing)return{created:false,record:existing};
  if(!input.store&&!hasDatabase())throw new Error("DATABASE_URL is not configured");
  const expectedFingerprint=previewFingerprint(input.preview),expectedSignature=signPreview(expectedFingerprint);
  if(input.previewFingerprint!==expectedFingerprint||!expectedSignature||input.previewSignature!==expectedSignature)throw new Error("preview-mismatch");
  const plan:DailyLockPlan={deadlineBangkok:input.preview.deadlineBangkok,firstResultAt:null,exactDeadlineKnown:Boolean(input.preview.deadlineBangkok),reason:input.preview.deadlineBangkok?"earliest-confirmed-close":"before-first-result-only"};
  const validity=validateDailyLock(plan,input.now??new Date()); if(!validity.allowed)throw new Error(validity.reason);
  for(const value of [input.preview.modes.a,input.preview.modes.b])if(value.digits.length!==6||new Set(value.digits).size!==6)throw new Error("daily-lock-requires-six-unique-digits");
  const historyVersion=createHash("sha256").update(`${input.preview.modes.a.historyVersion}|${input.preview.modes.b.historyVersion}`).digest("hex"), id=randomUUID(),
    options={recordKind:"daily-global-paired-lock",targetLotteryIds:input.preview.targets,scheduleLimitations:input.preview.scheduleLimitations,deadlineBangkok:input.preview.deadlineBangkok,modes:{a:{configuredCount:input.preview.modes.a.configuredCount,eligibleCount:input.preview.modes.a.eligibleCount,historyVersion:input.preview.modes.a.historyVersion},b:{configuredCount:input.preview.modes.b.configuredCount,eligibleCount:input.preview.modes.b.eligibleCount,historyVersion:input.preview.modes.b.historyVersion}}};
  const inserted=await store.insertBeforeDeadline({id,target_date:input.preview.targetDate,weekday:input.preview.weekday,formula_version:DAILY_GLOBAL_LOCK_FORMULA_VERSION,history_version:historyVersion,ranked_digits:{a:input.preview.modes.a.digits,b:input.preview.modes.b.digits},source_lottery_ids:{a:input.preview.modes.a.contributorLotteryIds,b:input.preview.modes.b.contributorLotteryIds},analysis_options:options},input.preview.deadlineBangkok!);
  if(inserted){if(!input.store)lockReadCache.delete(input.preview.targetDate);return{created:true,record:parseRecord(inserted)}}
  const raced=await readDailyGlobalLock(input.preview.targetDate,store); if(raced)return{created:false,record:raced};
  throw new Error("lock-deadline-passed");
}
