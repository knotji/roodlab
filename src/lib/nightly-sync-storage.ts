import { database, ensureDatabase } from "./database";

export type NightlySyncRunItem = {
  runId: string;
  lotteryId: string;
  ok: boolean;
  addedDraws: number | null;
  reconciledPredictions: number | null;
  errorMessage: string | null;
  completedAt: string;
};

export type NightlySyncRun = {
  id: string;
  startedAt: string;
  completedAt: string | null;
  checkedCount: number;
  eligibleCount: number;
  dueCount: number;
  successCount: number;
  failedCount: number;
};

export type NightlySyncRunStore = {
  create(run: NightlySyncRun): Promise<void>;
  recordItem(item: NightlySyncRunItem): Promise<void>;
  finish(run: NightlySyncRun): Promise<void>;
};

export const postgresNightlySyncRunStore: NightlySyncRunStore = {
  async create(run) {
    await ensureDatabase();
    await database().query(
      `INSERT INTO nightly_sync_runs(id,started_at,completed_at,checked_count,eligible_count,due_count,success_count,failed_count)
       VALUES($1::uuid,$2::timestamptz,NULL,$3,$4,$5,0,0)`,
      [run.id, run.startedAt, run.checkedCount, run.eligibleCount, run.dueCount],
    );
  },
  async recordItem(item) {
    await ensureDatabase();
    await database().query(
      `INSERT INTO nightly_sync_run_items(run_id,lottery_id,ok,added_draws,reconciled_predictions,error_message,completed_at)
       VALUES($1::uuid,$2,$3,$4,$5,$6,$7::timestamptz)
       ON CONFLICT(run_id,lottery_id) DO NOTHING`,
      [item.runId, item.lotteryId, item.ok, item.addedDraws, item.reconciledPredictions, item.errorMessage, item.completedAt],
    );
  },
  async finish(run) {
    await ensureDatabase();
    await database().query(
      `UPDATE nightly_sync_runs SET completed_at=$2::timestamptz,success_count=$3,failed_count=$4 WHERE id=$1::uuid`,
      [run.id, run.completedAt, run.successCount, run.failedCount],
    );
  },
};

export async function readLatestNightlySyncRun(): Promise<NightlySyncRun | null> {
  await ensureDatabase();
  const rows = await database().query(`SELECT * FROM nightly_sync_runs ORDER BY started_at DESC LIMIT 1`);
  if (!rows.length) return null;
  const row = rows[0] as Record<string, unknown>;
  return {
    id: String(row.id),
    startedAt: new Date(String(row.started_at)).toISOString(),
    completedAt: row.completed_at ? new Date(String(row.completed_at)).toISOString() : null,
    checkedCount: Number(row.checked_count),
    eligibleCount: Number(row.eligible_count),
    dueCount: Number(row.due_count),
    successCount: Number(row.success_count),
    failedCount: Number(row.failed_count),
  };
}
