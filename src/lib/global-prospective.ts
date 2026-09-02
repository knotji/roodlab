import { database, ensureDatabase, hasDatabase } from "./database";

export const GLOBAL_PROSPECTIVE_VERSION = "weekday-frequency-curated-v2";
export const GLOBAL_PROSPECTIVE_WRITES_ENABLED = false;
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

export async function captureNextGlobalProspective() {
  return { created: false, reason: "global-prospective-disabled" as const };
}

export async function reconcileGlobalProspectiveOutcomes() {
  return 0;
}

export async function listGlobalProspective(limit = 60) {
  if (!hasDatabase()) return [];
  await ensureGlobalSchema();
  return database().query(
    `SELECT p.*, COALESCE(jsonb_agg(jsonb_build_object('lotteryId',o.lottery_id,'outcome',o.outcome,'recordedAt',o.recorded_at)) FILTER (WHERE o.lottery_id IS NOT NULL),'[]'::jsonb) outcomes
     FROM global_prediction_snapshots p LEFT JOIN global_prediction_outcomes o ON o.prediction_id=p.id
     GROUP BY p.id ORDER BY p.target_date DESC LIMIT $1`, [limit]);
}
