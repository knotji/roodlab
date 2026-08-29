import { database, ensureDatabase, hasDatabase } from "./database";

export type SystemStatus = {
  storage: "neon" | "json-fallback";
  connected: boolean;
  snapshotCount: number;
  predictionCount: number;
  resolvedPredictionCount: number;
  latestSyncAt: string | null;
};

export async function getSystemStatus(): Promise<SystemStatus> {
  if (!hasDatabase()) return { storage: "json-fallback", connected: false, snapshotCount: 0, predictionCount: 0, resolvedPredictionCount: 0, latestSyncAt: null };
  try {
    await ensureDatabase();
    const rows = await database().query(`SELECT
      (SELECT count(*)::int FROM lottery_snapshots) AS snapshot_count,
      (SELECT count(*)::int FROM prediction_snapshots) AS prediction_count,
      (SELECT count(*)::int FROM prediction_outcomes) AS resolved_count,
      (SELECT max(synced_at) FROM lottery_snapshots) AS latest_sync_at`);
    const row = rows[0] as Record<string, unknown>;
    return {
      storage: "neon",
      connected: true,
      snapshotCount: Number(row.snapshot_count),
      predictionCount: Number(row.prediction_count),
      resolvedPredictionCount: Number(row.resolved_count),
      latestSyncAt: row.latest_sync_at ? new Date(String(row.latest_sync_at)).toISOString() : null,
    };
  } catch {
    return { storage: "json-fallback", connected: false, snapshotCount: 0, predictionCount: 0, resolvedPredictionCount: 0, latestSyncAt: null };
  }
}
