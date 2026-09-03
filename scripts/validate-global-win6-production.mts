import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { FROZEN_GLOBAL_POOL_46 } from "./frozen-global-pool-46";
import { drawWeekday } from "../src/lib/analysis/day-pattern";
import { pairCovered } from "../src/lib/analysis/global-weekday-evaluation";
import { buildGlobalWeekdayWin, GLOBAL_WEEKDAY_LOOKBACK } from "../src/lib/analysis/global-weekday-win";
import { computeHistoryVersion, readAllSnapshots, readCatalog } from "../src/lib/cache";
import { AllHuayDataSource } from "../src/lib/data-sources/allhuay";
import type { LotteryDraw } from "../src/lib/types";

const FREEZE_DATE = "2026-09-02", WIN_SIZE = 6, MIN_TARGET_LOTTERIES = 10, BOOTSTRAPS = 10_000, SEED = 20260902,
  reportBase = "global-win6-production-validation-2026-09-02";
const FROZEN_POOL_IDS = FROZEN_GLOBAL_POOL_46;

type Source = { lotteryId: string; historyVersion: string; draws: LotteryDraw[] };
type MetricKey = "top" | "bottom" | "either" | "both" | "recall";
type DateRow = Record<MetricKey | `expected_${MetricKey}`, number> & { date: string; outcomes: number; trainingLotteries: number };

const protocol = {
  freezeDate: FREEZE_DATE,
  pool: FROZEN_POOL_IDS,
  poolSize: FROZEN_POOL_IDS.length,
  formula: "production weekday-frequency overall ranking",
  winSize: WIN_SIZE,
  weekdayLookback: GLOBAL_WEEKDAY_LOOKBACK,
  sideWeights: { top2: 0.5, bottom2: 0.5 },
  digitPresence: "duplicate digit counted once per side/result",
  targetRule: "drawDate equals target date; complete top2 and bottom2 required",
  leakageRule: "training drawDate must be strictly before target date",
  minimumTargetLotteriesPerDate: MIN_TARGET_LOTTERIES,
  bootstrap: { resamples: BOOTSTRAPS, cluster: "target date", seed: SEED },
} as const;

function combinations(values: string[], size: number, start = 0, selected: string[] = [], output: string[][] = []): string[][] {
  if (selected.length === size) { output.push([...selected]); return output; }
  for (let index = start; index <= values.length - (size - selected.length); index += 1) {
    selected.push(values[index]); combinations(values, size, index + 1, selected, output); selected.pop();
  }
  return output;
}

const randomSets = combinations(Array.from({ length: 10 }, (_, digit) => String(digit)), WIN_SIZE);
function expected(pairTop: string, pairBottom: string) {
  const totals = randomSets.reduce((sum, selected) => {
    const top = pairCovered(selected, pairTop), bottom = pairCovered(selected, pairBottom), set = new Set(selected), digits = `${pairTop}${pairBottom}`.split("");
    sum.top += Number(top); sum.bottom += Number(bottom); sum.either += Number(top || bottom); sum.both += Number(top && bottom);
    sum.recall += digits.filter((digit) => set.has(digit)).length / digits.length;
    return sum;
  }, { top: 0, bottom: 0, either: 0, both: 0, recall: 0 });
  return Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, value / randomSets.length])) as Record<MetricKey, number>;
}

function aggregate(rows: DateRow[]) {
  const outcomes = rows.reduce((sum, row) => sum + row.outcomes, 0), result = {} as Record<MetricKey, { rate: number; baseline: number; uplift: number }>;
  for (const key of ["top", "bottom", "either", "both", "recall"] as MetricKey[]) {
    const rate = rows.reduce((sum, row) => sum + row[key], 0) / outcomes,
      baseline = rows.reduce((sum, row) => sum + row[`expected_${key}`], 0) / outcomes;
    result[key] = { rate, baseline, uplift: rate - baseline };
  }
  return { outcomes, metrics: result };
}

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => ((state = (1664525 * state + 1013904223) >>> 0) / 4294967296);
}

function percentile(values: number[], probability: number) {
  const sorted = [...values].sort((a, b) => a - b), index = (sorted.length - 1) * probability,
    lower = Math.floor(index), upper = Math.ceil(index), weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function confidence(rows: DateRow[]) {
  const random = seeded(SEED), samples = Object.fromEntries((["top", "bottom", "either", "both", "recall"] as MetricKey[]).map((key) => [key, { rate: [] as number[], uplift: [] as number[] }]));
  for (let iteration = 0; iteration < BOOTSTRAPS; iteration += 1) {
    const draw = Array.from({ length: rows.length }, () => rows[Math.floor(random() * rows.length)]), summary = aggregate(draw);
    for (const key of Object.keys(samples) as MetricKey[]) { samples[key].rate.push(summary.metrics[key].rate); samples[key].uplift.push(summary.metrics[key].uplift); }
  }
  return Object.fromEntries((Object.keys(samples) as MetricKey[]).map((key) => [key, {
    rate95: [percentile(samples[key].rate, 0.025), percentile(samples[key].rate, 0.975)],
    uplift95: [percentile(samples[key].uplift, 0.025), percentile(samples[key].uplift, 0.975)],
  }]));
}

function pct(value: number) { return `${(value * 100).toFixed(2)}%`; }
function pp(value: number) { return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}pp`; }

const snapshots = await readAllSnapshots(), frozenSet = new Set<string>(FROZEN_POOL_IDS), storedSources = Object.values(snapshots).filter((source) => frozenSet.has(source.lotteryId)) as Source[],
  missing = FROZEN_POOL_IDS.filter((id) => !storedSources.some((source) => source.lotteryId === id)), catalog = await readCatalog(), dataSource = new AllHuayDataSource(catalog),
  fetchedSources = await Promise.all(missing.map(async (lotteryId): Promise<Source> => {
    const result = await dataSource.getCanonicalHistory(lotteryId, { limit: 100 });
    if (!result.draws.length) throw new Error(`No historical draws returned for ${lotteryId}`);
    return { lotteryId, draws: result.draws, historyVersion: computeHistoryVersion(lotteryId, result.draws) };
  })), byId = new Map([...storedSources, ...fetchedSources].map((source) => [source.lotteryId, source])),
  sources = FROZEN_POOL_IDS.map((id) => byId.get(id)).filter((source): source is Source => Boolean(source));
if (sources.length !== FROZEN_POOL_IDS.length) throw new Error(`Frozen pool unavailable after read-only hydration: found ${sources.length}/${FROZEN_POOL_IDS.length}`);

const dates = [...new Set(sources.flatMap((source) => source.draws.map((draw) => draw.drawDate)))].filter((date) => date <= FREEZE_DATE).sort(), rows: DateRow[] = [],
  coverage = new Map(sources.map((source) => [source.lotteryId, { predictionDates: 0, trainingTotal: 0, min: 12, max: 0, targetOutcomes: 0 }]));

for (const date of dates) {
  const result = buildGlobalWeekdayWin(sources, { weekday: drawWeekday(date) as 0 | 1 | 2 | 3 | 4 | 5 | 6, cutoffDate: date }),
    targets = sources.flatMap((source) => source.draws.filter((draw) => draw.drawDate === date && draw.top2 && draw.bottom2).map((draw) => ({ source, draw })));
  if (!result.sufficient || targets.length < MIN_TARGET_LOTTERIES) continue;
  const selected = result.rankedDigits.slice(0, WIN_SIZE).map((item) => item.digit), row: DateRow = {
    date, outcomes: targets.length, trainingLotteries: result.lotteryCount,
    top: 0, bottom: 0, either: 0, both: 0, recall: 0,
    expected_top: 0, expected_bottom: 0, expected_either: 0, expected_both: 0, expected_recall: 0,
  };
  for (const { draw } of targets) {
    const top = pairCovered(selected, draw.top2!), bottom = pairCovered(selected, draw.bottom2!), set = new Set(selected), expectedValue = expected(draw.top2!, draw.bottom2!);
    row.top += Number(top); row.bottom += Number(bottom); row.either += Number(top || bottom); row.both += Number(top && bottom);
    row.recall += `${draw.top2}${draw.bottom2}`.split("").filter((digit) => set.has(digit)).length / 4;
    for (const key of ["top", "bottom", "either", "both", "recall"] as MetricKey[]) row[`expected_${key}`] += expectedValue[key];
  }
  for (const source of sources) {
    const training = source.draws.filter((draw) => draw.drawDate < date && drawWeekday(draw.drawDate) === drawWeekday(date) && (draw.top2 || draw.bottom2)).sort((a, b) => b.drawDate.localeCompare(a.drawDate)).slice(0, 12).length,
      item = coverage.get(source.lotteryId)!;
    if (training) { item.predictionDates += 1; item.trainingTotal += training; item.min = Math.min(item.min, training); item.max = Math.max(item.max, training); }
    item.targetOutcomes += source.draws.filter((draw) => draw.drawDate === date && draw.top2 && draw.bottom2).length;
  }
  rows.push(row);
}
if (!rows.length) throw new Error("No eligible walk-forward dates");

const summary = aggregate(rows), ci = confidence(rows), coverageRows = [...coverage].map(([lotteryId, item]) => ({ lotteryId, ...item, min: item.predictionDates ? item.min : 0, mean: item.predictionDates ? item.trainingTotal / item.predictionDates : 0 }));

function similarities() {
  const pairs: { left: string; right: string; aligned: number; exactRate: number }[] = [];
  for (let left = 0; left < sources.length; left += 1) for (let right = left + 1; right < sources.length; right += 1) {
    const a = new Map(sources[left].draws.filter((draw) => draw.drawDate <= FREEZE_DATE && draw.top2 && draw.bottom2).map((draw) => [draw.drawDate, `${draw.top2}|${draw.bottom2}`])),
      aligned = sources[right].draws.filter((draw) => draw.drawDate <= FREEZE_DATE && draw.top2 && draw.bottom2 && a.has(draw.drawDate));
    if (aligned.length >= 10) pairs.push({ left: sources[left].lotteryId, right: sources[right].lotteryId, aligned: aligned.length, exactRate: aligned.filter((draw) => a.get(draw.drawDate) === `${draw.top2}|${draw.bottom2}`).length / aligned.length });
  }
  return pairs.sort((a, b) => b.exactRate - a.exactRate || b.aligned - a.aligned).slice(0, 10);
}

const similarityRows = similarities(), protocolText = JSON.stringify(protocol), protocolHash = createHash("sha256").update(protocolText).digest("hex").slice(0, 16),
  historyHash = createHash("sha256").update(sources.map((source) => `${source.lotteryId}:${source.historyVersion}`).sort().join("|")).digest("hex").slice(0, 16),
  result = { protocol, protocolHash, historyHash, storageCoverage: { stored: storedSources.length, readOnlyHydrated: fetchedSources.map((source) => source.lotteryId) }, dates: rows.length, outcomes: summary.outcomes, summary, confidence: ci, coverage: coverageRows, similarity: similarityRows };

const labels: Record<MetricKey, string> = { top: "เข้าเต็มบน 2 ตัว", bottom: "เข้าเต็มล่าง 2 ตัว", either: "เข้าเต็มอย่างน้อยหนึ่งฝั่ง", both: "เข้าเต็มทั้งสองฝั่ง", recall: "Digit recall 4 ตำแหน่ง" },
  metricLines = (Object.keys(labels) as MetricKey[]).map((key) => `| ${labels[key]} | ${pct(summary.metrics[key].rate)} | ${pct(ci[key].rate95[0])} ถึง ${pct(ci[key].rate95[1])} | ${pct(summary.metrics[key].baseline)} | ${pp(summary.metrics[key].uplift)} | ${pp(ci[key].uplift95[0])} ถึง ${pp(ci[key].uplift95[1])} |`).join("\n"),
  coverageLines = coverageRows.map((item) => `| ${item.lotteryId} | ${item.predictionDates} | ${item.mean.toFixed(1)} | ${item.min}-${item.max} | ${item.targetOutcomes} |`).join("\n"),
  similarityLines = similarityRows.map((item) => `| ${item.left} | ${item.right} | ${item.aligned} | ${pct(item.exactRate)} |`).join("\n"),
  report = `# Frozen production validation — Global Win 6\n\nFreeze date: ${FREEZE_DATE}  \nProtocol fingerprint: \`${protocolHash}\`  \nHistory fingerprint: \`${historyHash}\`\n\n## Frozen production contract\n\n- Curated production pool: exactly 46 lotteries.\n- Overall ranking; select top 6 digits.\n- Same weekday only; maximum 12 prior matching weekdays per lottery.\n- Top2 and bottom2 weight 50:50; every lottery has equal weight.\n- Digit presence is counted once per side/result, including doubles.\n- Every target and future draw is excluded from its ranking.\n- Walk-forward dates require at least ${MIN_TARGET_LOTTERIES} complete target lotteries.\n- Exact random baselines enumerate all ${randomSets.length} possible six-digit subsets and preserve double-specific coverage.\n- Confidence intervals use ${BOOTSTRAPS.toLocaleString("en-US")} deterministic target-date clustered bootstrap samples.\n- This report validates the frozen formula only; no tuning or promotion is permitted from its results.\n\n## Data availability\n\n- Historical snapshots already stored: **${storedSources.length}/46**.\n- Missing snapshots hydrated read-only from the canonical source for this report: **${fetchedSources.length}** (${fetchedSources.map((source) => source.lotteryId).join(", ") || "none"}).\n- Validation hydration did not write snapshots or alter production storage.\n\n## Results\n\n- Walk-forward dates: **${rows.length}**\n- Complete lottery outcomes: **${summary.outcomes}**\n\n| Metric | Actual | Actual 95% CI | Exact random | Uplift | Date-clustered 95% CI of uplift |\n|---|---:|---:|---:|---:|---:|\n${metricLines}\n\n## Decision\n\n**FROZEN_VALIDATION_ONLY_NO_TUNING**\n\nThe production formula remains unchanged. Point estimates are not treated as predictive evidence when the uplift interval includes zero or lacks stability across future independent data.\n\n## Per-lottery sample coverage\n\n| Lottery ID | Prediction dates with history | Mean same-weekday training draws | Min-max | Target outcomes |\n|---|---:|---:|---:|---:|\n${coverageLines}\n\n## Potential source redundancy diagnostic\n\nExact top2+bottom2 agreement on aligned dates; diagnostic only. A duplicate flag requires at least 10 aligned dates and >=80% exact agreement.\n\n| Source A | Source B | Aligned dates | Exact agreement |\n|---|---|---:|---:|\n${similarityLines || "| — | — | 0 | — |"}\n\nDuplicate pairs at the frozen 80% threshold: **${similarityRows.filter((item) => item.exactRate >= 0.8).length}**. No family weighting or production change is made from this diagnostic.\n`;

async function freezeFile(file: string, content: string) {
  try { const existing = await fs.readFile(file, "utf8"); if (existing !== content) throw new Error(`Frozen report already exists with different content: ${file}`); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; await fs.writeFile(file, content, "utf8"); }
}

const reports = path.join(process.cwd(), "reports");
await fs.mkdir(reports, { recursive: true });
await freezeFile(path.join(reports, `${reportBase}.json`), `${JSON.stringify(result, null, 2)}\n`);
await freezeFile(path.join(reports, `${reportBase}.md`), report);
console.log(JSON.stringify({ report: `reports/${reportBase}.md`, protocolHash, historyHash, dates: rows.length, outcomes: summary.outcomes, metrics: summary.metrics }, null, 2));
