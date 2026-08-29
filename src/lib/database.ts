import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let queryClient: NeonQueryFunction<false, false> | null = null;
let migration: Promise<void> | null = null;

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
  await sql.query(`CREATE TABLE IF NOT EXISTS prediction_snapshots (id uuid PRIMARY KEY, lottery_id text NOT NULL, draw_date date NOT NULL, history_version text NOT NULL, algorithm_version text NOT NULL, standout_digits jsonb NOT NULL, ranked_pairs jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (lottery_id, draw_date, algorithm_version))`);
  await sql.query(`CREATE TABLE IF NOT EXISTS prediction_outcomes (prediction_id uuid PRIMARY KEY REFERENCES prediction_snapshots(id), outcome jsonb NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now())`);
  await sql.query(`CREATE OR REPLACE FUNCTION prevent_prediction_snapshot_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'prediction snapshots are immutable'; END; $$`);
  await sql.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'prediction_snapshots_immutable') THEN
      CREATE TRIGGER prediction_snapshots_immutable BEFORE UPDATE OR DELETE ON prediction_snapshots FOR EACH ROW EXECUTE FUNCTION prevent_prediction_snapshot_mutation();
    END IF;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$`);
}

export function ensureDatabase(): Promise<void> {
  migration ??= migrateDatabase().catch((error) => {
    migration = null;
    throw error;
  });
  return migration;
}
