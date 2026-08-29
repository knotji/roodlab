import { z } from "zod";
import { database, ensureDatabase } from "./database";
import type { Snapshot } from "./cache";

const JsonRowSchema = z.object({ value: z.unknown() });
const SnapshotRowSchema = z.object({ snapshot: z.unknown() });

export async function readDocument(key: string): Promise<unknown | null> {
  await ensureDatabase();
  const rows = await database().query("SELECT value FROM app_documents WHERE key = $1", [key]);
  return rows.length ? JsonRowSchema.parse(rows[0]).value : null;
}

export async function writeDocument(key: string, value: unknown): Promise<void> {
  await ensureDatabase();
  await database().query(`INSERT INTO app_documents (key, value, updated_at) VALUES ($1, $2::jsonb, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [key, JSON.stringify(value)]);
}

export async function readPostgresSnapshot(id: string): Promise<unknown | null> {
  await ensureDatabase();
  const rows = await database().query("SELECT snapshot FROM lottery_snapshots WHERE lottery_id = $1", [id]);
  return rows.length ? SnapshotRowSchema.parse(rows[0]).snapshot : null;
}

export async function readAllPostgresSnapshots(): Promise<unknown[]> {
  await ensureDatabase();
  const rows = await database().query("SELECT snapshot FROM lottery_snapshots ORDER BY lottery_id");
  return rows.map((row) => SnapshotRowSchema.parse(row).snapshot);
}

export async function writePostgresSnapshot(snapshot: Snapshot): Promise<void> {
  await ensureDatabase();
  await database().query(`INSERT INTO lottery_snapshots (lottery_id, history_version, synced_at, snapshot, updated_at) VALUES ($1, $2, $3::timestamptz, $4::jsonb, now()) ON CONFLICT (lottery_id) DO UPDATE SET history_version = EXCLUDED.history_version, synced_at = EXCLUDED.synced_at, snapshot = EXCLUDED.snapshot, updated_at = now()`, [snapshot.lotteryId, snapshot.historyVersion, snapshot.syncedAt, JSON.stringify(snapshot)]);
}
