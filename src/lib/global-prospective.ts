import { createHash, randomUUID } from "node:crypto";
import { currentBangkokDateKey, drawWeekday } from "./analysis/day-pattern";
import { buildGlobalWeekdayWin } from "./analysis/global-weekday-win";
import { readAllSnapshots } from "./cache";
import { database, ensureDatabase, hasDatabase } from "./database";
import { isCompleteDraw } from "./data-sources/integrity";
import type { LotteryDraw } from "./types";

export const GLOBAL_PROSPECTIVE_VERSION = "weekday-frequency-v1";
let schemaReady: Promise<void> | null = null;

function ensureGlobalSchema() {
  return schemaReady ??= (async () => {
    await ensureDatabase();
    await database().query(`CREATE TABLE IF NOT EXISTS global_prediction_snapshots (id uuid PRIMARY KEY, target_date date NOT NULL, weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6), formula_version text NOT NULL, history_version text NOT NULL, ranked_digits jsonb NOT NULL, source_lottery_ids jsonb NOT NULL, analysis_options jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (target_date, formula_version))`);
    await database().query(`CREATE TABLE IF NOT EXISTS global_prediction_outcomes (prediction_id uuid NOT NULL REFERENCES global_prediction_snapshots(id), lottery_id text NOT NULL, outcome jsonb NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (prediction_id, lottery_id))`);
    await database().query(`CREATE OR REPLACE FUNCTION prevent_prediction_snapshot_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'prediction snapshots are immutable'; END; $$`);
    await database().query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='global_prediction_snapshots_immutable') THEN CREATE TRIGGER global_prediction_snapshots_immutable BEFORE UPDATE OR DELETE ON global_prediction_snapshots FOR EACH ROW EXECUTE FUNCTION prevent_prediction_snapshot_mutation(); END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
  })();
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export async function captureNextGlobalProspective() {
  if (!hasDatabase()) return { created: false, reason: "database-unavailable" };
  const targetDate = addDays(currentBangkokDateKey(), 1), snapshots = Object.values(await readAllSnapshots()),
    result = buildGlobalWeekdayWin(snapshots, { weekday: drawWeekday(targetDate) as 0 | 1 | 2 | 3 | 4 | 5 | 6, cutoffDate: targetDate });
  if (!result.sufficient) return { created: false, reason: "insufficient-data", targetDate };
  const sourceLotteryIds = snapshots.map((item) => item.lotteryId).sort(),
    historyVersion = createHash("sha256").update(snapshots.map((item) => `${item.lotteryId}:${item.historyVersion}`).sort().join("|")).digest("hex").slice(0, 16),
    id = randomUUID();
  await ensureGlobalSchema();
  const rows = await database().query(
    `INSERT INTO global_prediction_snapshots (id, target_date, weekday, formula_version, history_version, ranked_digits, source_lottery_ids, analysis_options)
     VALUES ($1,$2::date,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb) ON CONFLICT (target_date, formula_version) DO NOTHING RETURNING id`,
    [id, targetDate, result.weekday, GLOBAL_PROSPECTIVE_VERSION, historyVersion, JSON.stringify(result.rankedDigits.map((item) => item.digit)), JSON.stringify(sourceLotteryIds), JSON.stringify({ lookbackPerLottery: result.lookbackPerLottery, lotteryCount: result.lotteryCount })],
  );
  return { created: rows.length === 1, targetDate, digits: result.rankedDigits.slice(0, 7).map((item) => item.digit), lotteryCount: result.lotteryCount };
}

export async function reconcileGlobalProspectiveOutcomes(lotteryId: string, draws: LotteryDraw[]) {
  if (!hasDatabase()) return 0;
  const completed = draws.filter(isCompleteDraw).map((draw) => ({ drawDate: draw.drawDate, top2: draw.top2, bottom2: draw.bottom2 }));
  if (!completed.length) return 0;
  await ensureGlobalSchema();
  const rows = await database().query(
    `INSERT INTO global_prediction_outcomes (prediction_id, lottery_id, outcome)
     SELECT p.id, $1, incoming.outcome FROM global_prediction_snapshots p
     JOIN jsonb_to_recordset($2::jsonb) incoming(draw_date text, outcome jsonb) ON p.target_date=incoming.draw_date::date
     ON CONFLICT (prediction_id, lottery_id) DO NOTHING RETURNING prediction_id`,
    [lotteryId, JSON.stringify(completed.map((item) => ({ draw_date: item.drawDate, outcome: item })))],
  );
  return rows.length;
}

export async function listGlobalProspective(limit = 60) {
  if (!hasDatabase()) return [];
  await ensureGlobalSchema();
  return database().query(
    `SELECT p.*, COALESCE(jsonb_agg(jsonb_build_object('lotteryId',o.lottery_id,'outcome',o.outcome,'recordedAt',o.recorded_at)) FILTER (WHERE o.lottery_id IS NOT NULL),'[]'::jsonb) outcomes
     FROM global_prediction_snapshots p LEFT JOIN global_prediction_outcomes o ON o.prediction_id=p.id
     GROUP BY p.id ORDER BY p.target_date DESC LIMIT $1`, [limit]);
}
