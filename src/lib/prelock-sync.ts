import { randomUUID } from "node:crypto";
import type { Snapshot } from "./cache";
import type { LotteryDefinition } from "./types";
import { buildDailyGlobalComparison } from "./analysis/daily-global-targets";
import type { PlayedUniverseWeekday } from "./analysis/played-universe";

export const PRELOCK_SYNC_BATCH_SIZE = 12;
export const PRELOCK_SYNC_MAX_RETRIES = 2;

export type PrelockSyncPlan = {
  targetDate: string;
  weekday: PlayedUniverseWeekday;
  deadlineBangkok: string | null;
  exactDeadlineKnown: boolean;
  aSourceIds: string[];
  bSourceIds: string[];
  sourceIds: string[];
  batches: string[][];
  scheduleLimitations: Array<{ lotteryId: string; issues: string[] }>;
};

export type PrelockSyncAttempt = {
  runId: string;
  lotteryId: string;
  batchIndex: number;
  attempt: number;
  ok: boolean;
  outcome: string | null;
  addedDraws: number | null;
  latestCompleteDrawDate: string | null;
  freshnessStatus: string | null;
  errorClass: string | null;
  errorMessage: string | null;
  completedAt: string;
};

export type PrelockSyncRun = {
  id: string;
  targetDate: string;
  weekday: number;
  deadlineBangkok: string | null;
  status: "running" | "ready" | "not-ready" | "failed";
  sourceIds: string[];
  aSourceIds: string[];
  bSourceIds: string[];
  batchCount: number;
  successCount: number;
  failedCount: number;
  readiness: Record<string, unknown>;
  startedAt: string;
  completedAt: string | null;
};

export type PrelockSyncRunStore = {
  create(run: PrelockSyncRun): Promise<void>;
  recordAttempt(attempt: PrelockSyncAttempt): Promise<void>;
  finish(run: PrelockSyncRun): Promise<void>;
};

export function buildPrelockSyncPlan(input: {
  catalog: LotteryDefinition[];
  snapshots: Record<string, Snapshot>;
  audit?: Record<string, { status: "supported" | "partial" | "failed" }>;
  targetDate: string;
  weekday: PlayedUniverseWeekday;
  batchSize?: number;
}): PrelockSyncPlan {
  const comparison = buildDailyGlobalComparison(input),
    aSourceIds = comparison.modes.locked.eligibility.map((item) => item.lotteryId),
    bSourceIds = comparison.modes.today_eligible.eligibility.map((item) => item.lotteryId),
    sourceIds = [...new Set([...aSourceIds, ...bSourceIds])].sort(),
    batchSize = input.batchSize ?? PRELOCK_SYNC_BATCH_SIZE;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > PRELOCK_SYNC_BATCH_SIZE)
    throw new Error(`batchSize must be an integer from 1 to ${PRELOCK_SYNC_BATCH_SIZE}`);
  return {
    targetDate: input.targetDate,
    weekday: input.weekday,
    deadlineBangkok: comparison.lockPlan.deadlineBangkok,
    exactDeadlineKnown: comparison.lockPlan.exactDeadlineKnown,
    aSourceIds,
    bSourceIds,
    sourceIds,
    batches: Array.from({ length: Math.ceil(sourceIds.length / batchSize) }, (_, index) => sourceIds.slice(index * batchSize, (index + 1) * batchSize)),
    scheduleLimitations: comparison.scheduleLimitations.map((item) => ({ lotteryId: item.lotteryId, issues: item.scheduleIssues })),
  };
}

function safeError(error: unknown) {
  let message = error instanceof Error ? error.message.slice(0, 500) : "sync failed";
  for (const name of ["DATABASE_URL","TEST_DATABASE_URL","CRON_SECRET","DAILY_LOCK_SECRET","DAILY_LOCK_SIGNING_SECRET"] as const) {
    const secret = process.env[name];
    if (secret) message = message.replaceAll(secret, "[redacted]");
  }
  message = message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[redacted-database-url]");
  return {
    errorClass: error instanceof Error ? error.name : "UnknownError",
    errorMessage: message,
  };
}

export async function executePrelockSync(input: {
  plan: PrelockSyncPlan;
  store: PrelockSyncRunStore;
  syncOne: (lotteryId: string) => Promise<{ outcome: string; addedDraws: number; snapshot: Snapshot; freshness: { status: string } }>;
  evaluateReadiness: () => Promise<Record<string, unknown> & { ready: boolean }>;
  retries?: number;
  now?: () => Date;
}) {
  const now = input.now ?? (() => new Date()), retries = input.retries ?? PRELOCK_SYNC_MAX_RETRIES,
    run: PrelockSyncRun = { id: randomUUID(), targetDate: input.plan.targetDate, weekday: input.plan.weekday, deadlineBangkok: input.plan.deadlineBangkok,
      status: "running", sourceIds: input.plan.sourceIds, aSourceIds: input.plan.aSourceIds, bSourceIds: input.plan.bSourceIds,
      batchCount: input.plan.batches.length, successCount: 0, failedCount: 0, readiness: {}, startedAt: now().toISOString(), completedAt: null };
  await input.store.create(run);
  const finalItems: PrelockSyncAttempt[] = [];
  for (let batchIndex = 0; batchIndex < input.plan.batches.length; batchIndex += 1) {
    const batch = input.plan.batches[batchIndex];
    if (input.plan.deadlineBangkok && now().getTime() >= new Date(input.plan.deadlineBangkok).getTime()) {
      for (const lotteryId of input.plan.batches.slice(batchIndex).flat()) {
        const item:PrelockSyncAttempt={runId:run.id,lotteryId,batchIndex,attempt:0,ok:false,outcome:null,addedDraws:null,latestCompleteDrawDate:null,freshnessStatus:null,errorClass:"DeadlineExceeded",errorMessage:"pre-lock sync deadline passed before this source was attempted",completedAt:now().toISOString()};
        await input.store.recordAttempt(item);finalItems.push(item);
      }
      break;
    }
    const items = await Promise.all(batch.map(async (lotteryId) => {
      let final: PrelockSyncAttempt | null = null;
      for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
        try {
          const result = await input.syncOne(lotteryId);
          final = { runId: run.id, lotteryId, batchIndex, attempt, ok: true, outcome: result.outcome, addedDraws: result.addedDraws,
            latestCompleteDrawDate: result.snapshot.latestCompleteDrawDate ?? null, freshnessStatus: result.freshness.status,
            errorClass: null, errorMessage: null, completedAt: now().toISOString() };
          await input.store.recordAttempt(final);
          break;
        } catch (error) {
          const failure = safeError(error);
          final = { runId: run.id, lotteryId, batchIndex, attempt, ok: false, outcome: null, addedDraws: null,
            latestCompleteDrawDate: null, freshnessStatus: null, ...failure, completedAt: now().toISOString() };
          await input.store.recordAttempt(final);
        }
      }
      return final!;
    }));
    finalItems.push(...items);
  }
  const readiness = await input.evaluateReadiness(), successCount = finalItems.filter((item) => item.ok).length,
    failedCount = finalItems.length - successCount, deadlinePassed = input.plan.deadlineBangkok ? now().getTime() >= new Date(input.plan.deadlineBangkok).getTime() : true,
    ready = failedCount === 0 && !deadlinePassed && input.plan.exactDeadlineKnown && readiness.ready;
  const completed: PrelockSyncRun = { ...run, status: ready ? "ready" : failedCount ? "failed" : "not-ready", successCount, failedCount,
    readiness: { ...readiness, deadlinePassed, exactDeadlineKnown: input.plan.exactDeadlineKnown }, completedAt: now().toISOString() };
  await input.store.finish(completed);
  return { run: completed, finalItems };
}
