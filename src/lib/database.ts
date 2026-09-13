import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let queryClient: NeonQueryFunction<false, false> | null = null;

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function database(): NeonQueryFunction<false, false> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  queryClient ??= neon(connectionString);
  return queryClient;
}

export async function migrateDatabase(): Promise<void> {
  const sql = database();
  await sql.query(`CREATE TABLE IF NOT EXISTS app_documents (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`);
  await sql.query(`CREATE TABLE IF NOT EXISTS lottery_snapshots (lottery_id text PRIMARY KEY, history_version text NOT NULL, synced_at timestamptz NOT NULL, snapshot jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`);
  await sql.query(`CREATE INDEX IF NOT EXISTS lottery_snapshots_synced_at_idx ON lottery_snapshots (synced_at DESC)`);
  await sql.query(`CREATE TABLE IF NOT EXISTS write_rate_limits (key text PRIMARY KEY, available_at timestamptz NOT NULL)`);
  await sql.query(`CREATE TABLE IF NOT EXISTS prediction_snapshots (id uuid PRIMARY KEY, lottery_id text NOT NULL, draw_date date NOT NULL, history_version text NOT NULL, algorithm_version text NOT NULL, standout_digits jsonb NOT NULL, ranked_pairs jsonb NOT NULL, analysis_options jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (lottery_id, draw_date, algorithm_version))`);
  await sql.query(`ALTER TABLE prediction_snapshots ADD COLUMN IF NOT EXISTS analysis_options jsonb NOT NULL DEFAULT '{}'::jsonb`);
  await sql.query(`CREATE TABLE IF NOT EXISTS prediction_outcomes (prediction_id uuid PRIMARY KEY REFERENCES prediction_snapshots(id), outcome jsonb NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now())`);
  await sql.query(`CREATE TABLE IF NOT EXISTS global_prediction_snapshots (id uuid PRIMARY KEY, target_date date NOT NULL, weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6), formula_version text NOT NULL, history_version text NOT NULL, ranked_digits jsonb NOT NULL, source_lottery_ids jsonb NOT NULL, analysis_options jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (target_date, formula_version))`);
  await sql.query(`CREATE TABLE IF NOT EXISTS global_prediction_outcomes (prediction_id uuid NOT NULL REFERENCES global_prediction_snapshots(id), lottery_id text NOT NULL, outcome jsonb NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (prediction_id, lottery_id))`);
  await sql.query(`CREATE TABLE IF NOT EXISTS daily_sync_runs (id uuid PRIMARY KEY,target_date date NOT NULL,weekday smallint NOT NULL CHECK(weekday BETWEEN 0 AND 6),deadline_bangkok timestamptz,status text NOT NULL CHECK(status IN ('running','ready','not-ready','failed')),source_ids jsonb NOT NULL,a_source_ids jsonb NOT NULL,b_source_ids jsonb NOT NULL,batch_count integer NOT NULL,success_count integer NOT NULL DEFAULT 0,failed_count integer NOT NULL DEFAULT 0,readiness jsonb NOT NULL DEFAULT '{}'::jsonb,started_at timestamptz NOT NULL,completed_at timestamptz)`);
  await sql.query(`CREATE INDEX IF NOT EXISTS daily_sync_runs_target_started_idx ON daily_sync_runs(target_date,started_at DESC)`);
  await sql.query(`CREATE TABLE IF NOT EXISTS daily_sync_run_items (run_id uuid NOT NULL REFERENCES daily_sync_runs(id),lottery_id text NOT NULL,batch_index integer NOT NULL,attempt integer NOT NULL,ok boolean NOT NULL,outcome text,added_draws integer,latest_complete_draw_date date,freshness_status text,error_class text,error_message text,completed_at timestamptz NOT NULL,PRIMARY KEY(run_id,lottery_id,attempt))`);
  await sql.query(`CREATE TABLE IF NOT EXISTS nightly_sync_runs (id uuid PRIMARY KEY,started_at timestamptz NOT NULL,completed_at timestamptz,checked_count integer NOT NULL DEFAULT 0,eligible_count integer NOT NULL DEFAULT 0,due_count integer NOT NULL DEFAULT 0,success_count integer NOT NULL DEFAULT 0,failed_count integer NOT NULL DEFAULT 0)`);
  await sql.query(`CREATE INDEX IF NOT EXISTS nightly_sync_runs_started_idx ON nightly_sync_runs(started_at DESC)`);
  await sql.query(`CREATE TABLE IF NOT EXISTS nightly_sync_run_items (run_id uuid NOT NULL REFERENCES nightly_sync_runs(id),lottery_id text NOT NULL,ok boolean NOT NULL,added_draws integer,reconciled_predictions integer,error_message text,completed_at timestamptz NOT NULL,PRIMARY KEY(run_id,lottery_id))`);
  await sql.query(`CREATE OR REPLACE FUNCTION prevent_prediction_snapshot_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'prediction snapshots are immutable'; END; $$`);
  await sql.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'prediction_snapshots_immutable') THEN
      CREATE TRIGGER prediction_snapshots_immutable BEFORE UPDATE OR DELETE ON prediction_snapshots FOR EACH ROW EXECUTE FUNCTION prevent_prediction_snapshot_mutation();
    END IF;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`);
  await sql.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'global_prediction_snapshots_immutable') THEN
      CREATE TRIGGER global_prediction_snapshots_immutable BEFORE UPDATE OR DELETE ON global_prediction_snapshots FOR EACH ROW EXECUTE FUNCTION prevent_prediction_snapshot_mutation();
    END IF;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`);
}

export function ensureDatabase(): Promise<void> {
  database();
  return Promise.resolve();
}
