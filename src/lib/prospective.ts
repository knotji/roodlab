import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ALGORITHMS } from "./analysis/algorithms";
import { drawWeekday, filterDrawsByDay, type DayPattern } from "./analysis/day-pattern";
import { analyzeLottery, rankAllPairs } from "./analysis/engine";
import { hasDatabase } from "./database";
import { readSnapshot } from "./cache";
import { database, ensureDatabase } from "./database";
import { getCanonicalDataset } from "./history-provider";
import { isCompleteDraw } from "./data-sources/integrity";
import type { LotteryDraw } from "./types";

const CaptureSchema = z.object({
  drawDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  algorithmId: z.string(),
  window: z.number().int().min(10).max(100),
  candidateCount: z.number().int().min(1).max(20),
  includeDoubles: z.boolean(),
  dayPattern: z.union([z.literal("all"), z.number().int().min(0).max(6)]),
});

const RecordSchema = z.object({
  id: z.string(),
  lotteryId: z.string(),
  drawDate: z.string(),
  historyVersion: z.string(),
  algorithmVersion: z.string(),
  standoutDigits: z.array(z.string()),
  rankedPairs: z.object({ top: z.array(z.string()), bottom: z.array(z.string()) }),
  analysisOptions: z.object({
    window: z.number(),
    candidateCount: z.number(),
    includeDoubles: z.boolean(),
    dayPattern: z.union([z.literal("all"), z.number()]),
    sampleSize: z.number(),
  }),
  createdAt: z.string(),
  outcome: z.object({
    drawDate: z.string(),
    top3: z.string().optional(),
    top2: z.string().optional(),
    bottom2: z.string().optional(),
    recordedAt: z.string(),
  }).nullable(),
});

export type ProspectiveRecord = z.infer<typeof RecordSchema>;
export type CaptureProspectiveInput = z.input<typeof CaptureSchema>;

function mapRecord(row: Record<string, unknown>): ProspectiveRecord {
  return RecordSchema.parse({
    id: row.id,
    lotteryId: row.lottery_id,
    drawDate: String(row.draw_date).slice(0, 10),
    historyVersion: row.history_version,
    algorithmVersion: row.algorithm_version,
    standoutDigits: row.standout_digits,
    rankedPairs: row.ranked_pairs,
    analysisOptions: row.analysis_options,
    createdAt: new Date(String(row.created_at)).toISOString(),
    outcome: row.outcome
      ? { ...(row.outcome as object), recordedAt: new Date(String(row.recorded_at)).toISOString() }
      : null,
  });
}

export async function listProspective(lotteryId: string): Promise<ProspectiveRecord[]> {
  if (!hasDatabase()) return [];
  await ensureDatabase();
  const rows = await database().query(
    `SELECT p.*, o.outcome, o.recorded_at
     FROM prediction_snapshots p
     LEFT JOIN prediction_outcomes o ON o.prediction_id = p.id
     WHERE p.lottery_id = $1
     ORDER BY p.draw_date DESC, p.created_at DESC
     LIMIT 30`,
    [lotteryId],
  );
  return rows.map((row) => mapRecord(row as Record<string, unknown>));
}

export async function listAllProspective(limit = 500): Promise<ProspectiveRecord[]> {
  if (!hasDatabase()) return [];
  await ensureDatabase();
  const rows = await database().query(
    `SELECT p.*, o.outcome, o.recorded_at
     FROM prediction_snapshots p
     LEFT JOIN prediction_outcomes o ON o.prediction_id = p.id
     ORDER BY p.draw_date DESC, p.created_at DESC
     LIMIT $1`,
    [limit],
  );
  return rows.map((row) => mapRecord(row as Record<string, unknown>));
}

export async function pendingDueLotteryIds(limit = 10): Promise<string[]> {
  if (!hasDatabase()) return [];
  await ensureDatabase();
  const rows = await database().query(
    `SELECT DISTINCT p.lottery_id
     FROM prediction_snapshots p
     LEFT JOIN prediction_outcomes o ON o.prediction_id = p.id
     WHERE o.prediction_id IS NULL
       AND p.draw_date <= (now() AT TIME ZONE 'Asia/Bangkok')::date
     ORDER BY p.lottery_id
     LIMIT $1`,
    [limit],
  );
  return rows.map((row) => String((row as Record<string, unknown>).lottery_id));
}

export async function captureProspective(
  lotteryId: string,
  rawInput: unknown,
): Promise<{ created: boolean; record: ProspectiveRecord }> {
  if (!hasDatabase()) throw new Error("Prospective tracking ต้องเชื่อมต่อ Neon");
  const input = CaptureSchema.parse(rawInput), snapshot = await readSnapshot(lotteryId);
  if (!snapshot) throw new Error("ยังไม่มีข้อมูลย้อนหลังสำหรับหวยนี้");
  const canonical = getCanonicalDataset(snapshot, input.window);
  if (canonical.history.some((draw) => draw.drawDate === input.drawDate))
    throw new Error("วันที่นี้มีผลรางวัลอยู่แล้ว จึงล็อกย้อนหลังไม่ได้");
  if (canonical.latestDrawDate && input.drawDate <= canonical.latestDrawDate)
    throw new Error("ต้องเลือกวันที่หลังงวดล่าสุดเท่านั้น");
  if (input.dayPattern !== "all" && drawWeekday(input.drawDate) !== input.dayPattern)
    throw new Error("วันที่เลือกไม่ตรงกับตัวกรองวันของการวิเคราะห์");
  const algorithm = ALGORITHMS.find((item) => item.id === input.algorithmId);
  if (!algorithm) throw new Error("ไม่พบ algorithm version ที่เลือก");
  const dayPattern = input.dayPattern as DayPattern,
    history = filterDrawsByDay(canonical.analysisHistory, dayPattern),
    analysis = analyzeLottery(history, input),
    top = rankAllPairs(history, "top", input.algorithmId, undefined, input.window, input.includeDoubles),
    bottom = rankAllPairs(history, "bottom", input.algorithmId, undefined, input.window, input.includeDoubles),
    id = randomUUID(), algorithmVersion = `${algorithm.id}@${algorithm.version}`,
    standoutDigits = analysis.standout.map((item) => item.digit),
    rankedPairs = { top: top.map((item) => item.pair), bottom: bottom.map((item) => item.pair) },
    analysisOptions = { ...input, sampleSize: analysis.sampleSize };
  await ensureDatabase();
  const rows = await database().query(
    `INSERT INTO prediction_snapshots
       (id, lottery_id, draw_date, history_version, algorithm_version, standout_digits, ranked_pairs, analysis_options)
     VALUES ($1, $2, $3::date, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb)
     ON CONFLICT (lottery_id, draw_date, algorithm_version) DO NOTHING
     RETURNING *`,
    [id, lotteryId, input.drawDate, canonical.historyVersion, algorithmVersion, JSON.stringify(standoutDigits), JSON.stringify(rankedPairs), JSON.stringify(analysisOptions)],
  );
  if (!rows.length) {
    const existing = (await listProspective(lotteryId)).find(
      (item) => item.drawDate === input.drawDate && item.algorithmVersion === algorithmVersion,
    );
    if (!existing) throw new Error("ไม่สามารถอ่าน snapshot ที่ล็อกไว้แล้วได้");
    return { created: false, record: existing };
  }
  return { created: true, record: mapRecord({ ...rows[0] as object, outcome: null, recorded_at: null }) };
}

export async function reconcileProspectiveOutcomes(
  lotteryId: string,
  draws: LotteryDraw[],
): Promise<number> {
  if (!hasDatabase()) return 0;
  await ensureDatabase();
  let reconciled = 0;
  for (const draw of draws.filter(isCompleteDraw)) {
    const rows = await database().query(
      `INSERT INTO prediction_outcomes (prediction_id, outcome)
       SELECT id, $3::jsonb FROM prediction_snapshots
       WHERE lottery_id = $1 AND draw_date = $2::date
       ON CONFLICT (prediction_id) DO NOTHING
       RETURNING prediction_id`,
      [lotteryId, draw.drawDate, JSON.stringify({ drawDate: draw.drawDate, top3: draw.top3, top2: draw.top2, bottom2: draw.bottom2 })],
    );
    reconciled += rows.length;
  }
  return reconciled;
}
