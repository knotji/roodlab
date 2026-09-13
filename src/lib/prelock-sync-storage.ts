import { database, ensureDatabase } from "./database";
import type { PrelockSyncRun, PrelockSyncRunStore } from "./prelock-sync";

export const postgresPrelockSyncRunStore: PrelockSyncRunStore = {
  async create(run) {
    await ensureDatabase();
    await database().query(
      `INSERT INTO daily_sync_runs(id,target_date,weekday,deadline_bangkok,status,source_ids,a_source_ids,b_source_ids,batch_count,success_count,failed_count,readiness,started_at,completed_at)
       VALUES($1::uuid,$2::date,$3,$4::timestamptz,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9,0,0,'{}'::jsonb,$10::timestamptz,NULL)`,
      [run.id,run.targetDate,run.weekday,run.deadlineBangkok,run.status,JSON.stringify(run.sourceIds),JSON.stringify(run.aSourceIds),JSON.stringify(run.bSourceIds),run.batchCount,run.startedAt],
    );
  },
  async recordAttempt(item) {
    await ensureDatabase();
    await database().query(
      `INSERT INTO daily_sync_run_items(run_id,lottery_id,batch_index,attempt,ok,outcome,added_draws,latest_complete_draw_date,freshness_status,error_class,error_message,completed_at)
       VALUES($1::uuid,$2,$3,$4,$5,$6,$7,$8::date,$9,$10,$11,$12::timestamptz)
       ON CONFLICT(run_id,lottery_id,attempt) DO NOTHING`,
      [item.runId,item.lotteryId,item.batchIndex,item.attempt,item.ok,item.outcome,item.addedDraws,item.latestCompleteDrawDate,item.freshnessStatus,item.errorClass,item.errorMessage,item.completedAt],
    );
  },
  async finish(run) {
    await ensureDatabase();
    await database().query(
      `UPDATE daily_sync_runs SET status=$2,success_count=$3,failed_count=$4,readiness=$5::jsonb,completed_at=$6::timestamptz WHERE id=$1::uuid`,
      [run.id,run.status,run.successCount,run.failedCount,JSON.stringify(run.readiness),run.completedAt],
    );
  },
};

export async function readLatestPrelockSyncRun(targetDate: string): Promise<PrelockSyncRun | null> {
  await ensureDatabase();
  const rows = await database().query(`SELECT * FROM daily_sync_runs WHERE target_date=$1::date ORDER BY started_at DESC LIMIT 1`, [targetDate]);
  if (!rows.length) return null;
  const row = rows[0] as Record<string, unknown>;
  return { id:String(row.id),targetDate:String(row.target_date),weekday:Number(row.weekday),deadlineBangkok:row.deadline_bangkok ? new Date(String(row.deadline_bangkok)).toISOString() : null,
    status:row.status as PrelockSyncRun["status"],sourceIds:row.source_ids as string[],aSourceIds:row.a_source_ids as string[],bSourceIds:row.b_source_ids as string[],
    batchCount:Number(row.batch_count),successCount:Number(row.success_count),failedCount:Number(row.failed_count),readiness:(row.readiness ?? {}) as Record<string,unknown>,
    startedAt:new Date(String(row.started_at)).toISOString(),completedAt:row.completed_at ? new Date(String(row.completed_at)).toISOString() : null };
}
