import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import nextEnv from "@next/env";
import { drawWeekday } from "../src/lib/analysis/day-pattern";
import {
  evaluateProductionOutcome,
  PRODUCTION_WIN_SIZE,
  summarizeProductionEvidence,
  type ProductionEvidenceRow,
} from "../src/lib/analysis/global-production-evidence";
import { buildProductionGlobalWeekdayWin, resolvePlayedUniverseTargets } from "../src/lib/analysis/global-universe";
import { readAllSnapshots, readCatalog } from "../src/lib/cache";

const FREEZE_DATE = "2026-09-11",
  MIN_TARGET_OUTCOMES = 10,
  MIN_TRAINING_SOURCES = 10,
  BOOTSTRAPS = 10_000,
  SEED = 20260911,
  REPORT_NAME = `current-global-win6-evidence-${FREEZE_DATE}`;

const protocol = {
  question: "Does the current Production Global Win 6 beat its exact random-set baseline under the same hit definition?",
  freezeDate: FREEZE_DATE,
  sourceUniverse: "current weekday-specific Played Universe from production source of truth",
  scoringPath: "buildProductionGlobalWeekdayWin",
  targetPopulation: "complete top2+bottom2 outcomes from the same Played Universe",
  winSize: PRODUCTION_WIN_SIZE,
  sameWeekdayLookbackPerLottery: 12,
  sourceWeighting: "equal per eligible lottery",
  sideWeighting: "available-side equal weighting",
  leakageRule: "only draws strictly before target date enter ranking",
  historicalOperationalRule: "current provider suspension/freshness is not applied backward",
  minimumTrainingSources: MIN_TRAINING_SOURCES,
  minimumTargetOutcomes: MIN_TARGET_OUTCOMES,
  randomBaseline: "exact enumeration of all 210 six-digit subsets, outcome-specific for doubles and shared digits",
  confidence: { method: "target-date clustered bootstrap", iterations: BOOTSTRAPS, seed: SEED },
  tuning: "none",
  productionChange: false,
} as const;

type Metric = "top" | "bottom" | "either" | "both" | "digitRecall";

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => ((state = (1664525 * state + 1013904223) >>> 0) / 4294967296);
}

function percentile(values: number[], probability: number) {
  const sorted = [...values].sort((a, b) => a - b),
    index = (sorted.length - 1) * probability,
    lower = Math.floor(index), upper = Math.ceil(index), weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function confidence(rows: ProductionEvidenceRow[]) {
  const random = seeded(SEED), metrics: Metric[] = ["top", "bottom", "either", "both", "digitRecall"],
    samples = Object.fromEntries(metrics.map((metric) => [metric, { rate: [] as number[], uplift: [] as number[] }]));
  for (let repeat = 0; repeat < BOOTSTRAPS; repeat += 1) {
    const sample = Array.from({ length: rows.length }, () => rows[Math.floor(random() * rows.length)]),
      summary = summarizeProductionEvidence(sample);
    for (const metric of metrics) {
      samples[metric].rate.push(summary.metrics[metric].rate);
      samples[metric].uplift.push(summary.metrics[metric].uplift);
    }
  }
  return Object.fromEntries(metrics.map((metric) => [metric, {
    rate95: [percentile(samples[metric].rate, 0.025), percentile(samples[metric].rate, 0.975)],
    uplift95: [percentile(samples[metric].uplift, 0.025), percentile(samples[metric].uplift, 0.975)],
  }])) as Record<Metric, { rate95: [number, number]; uplift95: [number, number] }>;
}

nextEnv.loadEnvConfig(process.cwd());
const [catalog, snapshots] = await Promise.all([readCatalog(), readAllSnapshots()]),
  dates = [...new Set(Object.values(snapshots).flatMap((snapshot) => snapshot.draws.map((draw) => draw.drawDate)))]
    .filter((date) => date <= FREEZE_DATE).sort(),
  rows: ProductionEvidenceRow[] = [],
  coverage: Array<{ date: string; weekday: number; configured: number; eligible: number; targets: number }> = [];

for (const date of dates) {
  const weekday = drawWeekday(date) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    production = buildProductionGlobalWeekdayWin({ catalog, snapshots, targetDate: date, weekday, historical: true }),
    targets = resolvePlayedUniverseTargets({ catalog, snapshots, weekday, date });
  if (!production.result.sufficient || production.universe.eligibleCount < MIN_TRAINING_SOURCES || targets.length < MIN_TARGET_OUTCOMES) continue;
  const selected = production.result.rankedDigits.slice(0, PRODUCTION_WIN_SIZE).map((item) => item.digit),
    row: ProductionEvidenceRow = {
      date, outcomes: targets.length, topHits: 0, bottomHits: 0, eitherHits: 0, bothHits: 0, digitRecallTotal: 0,
      expectedTop: 0, expectedBottom: 0, expectedEither: 0, expectedBoth: 0, expectedDigitRecall: 0,
    };
  for (const target of targets) {
    const value = evaluateProductionOutcome(selected, target.top2, target.bottom2);
    row.topHits += value.top; row.bottomHits += value.bottom; row.eitherHits += value.either; row.bothHits += value.both;
    row.digitRecallTotal += value.digitRecall; row.expectedTop += value.expectedTop; row.expectedBottom += value.expectedBottom;
    row.expectedEither += value.expectedEither; row.expectedBoth += value.expectedBoth; row.expectedDigitRecall += value.expectedDigitRecall;
  }
  rows.push(row);
  coverage.push({ date, weekday, configured: production.universe.configuredCount, eligible: production.universe.eligibleCount, targets: targets.length });
}
if (!rows.length) throw new Error("No eligible walk-forward dates for the current Production contract");

const summary = summarizeProductionEvidence(rows), intervals = confidence(rows),
  months = [...new Set(rows.map((row) => row.date.slice(0, 7)))].map((month) => ({ month, ...summarizeProductionEvidence(rows.filter((row) => row.date.startsWith(month))) })),
  historyHash = createHash("sha256").update(Object.values(snapshots).sort((a, b) => a.lotteryId.localeCompare(b.lotteryId)).map((snapshot) => `${snapshot.lotteryId}:${snapshot.historyVersion}`).join("|")).digest("hex").slice(0, 16),
  protocolHash = createHash("sha256").update(JSON.stringify(protocol)).digest("hex").slice(0, 16),
  primaryCi = intervals.either.uplift95,
  decision = primaryCi[0] > 0 ? "POSITIVE_RETROSPECTIVE_EVIDENCE_REQUIRES_INDEPENDENT_CONFIRMATION" : primaryCi[1] < 0 ? "BELOW_EXACT_RANDOM_BASELINE" : "NO_CLEAR_EDGE_OVER_EXACT_RANDOM_BASELINE",
  result = { protocol, protocolHash, historyHash, data: { catalog: catalog.length, snapshots: Object.keys(snapshots).length, dateRange: [rows[0].date, rows.at(-1)!.date], evaluatedDates: rows.length, outcomes: summary.outcomes }, summary, confidence: intervals, monthly: months, coverage, decision };

const pct = (value: number) => `${(value * 100).toFixed(2)}%`,
  pp = (value: number) => `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}pp`,
  labels: Record<Metric, string> = { top: "Full pair covered - top", bottom: "Full pair covered - bottom", either: "Full pair covered - either side", both: "Full pair covered - both sides", digitRecall: "Digit recall across four positions" },
  metricRows = (Object.keys(labels) as Metric[]).map((metric) => `| ${labels[metric]} | ${pct(summary.metrics[metric].rate)} | ${pct(summary.metrics[metric].baseline)} | ${pp(summary.metrics[metric].uplift)} | ${pp(intervals[metric].uplift95[0])} to ${pp(intervals[metric].uplift95[1])} |`).join("\n"),
  monthRows = months.map((month) => `| ${month.month} | ${month.dates} | ${month.outcomes} | ${pct(month.metrics.either.rate)} | ${pct(month.metrics.either.baseline)} | ${pp(month.metrics.either.uplift)} |`).join("\n"),
  report = `# Current Production Global Win 6 evidence\n\nFreeze date: ${FREEZE_DATE}\n\nProtocol: \`${protocolHash}\`\n\nHistory: \`${historyHash}\`\n\n## Frozen question\n\nDoes the current Production Global Win 6 beat the exact random-set baseline under the identical hit definition? This evaluator validates one existing strategy. It does not search candidates, tune weights, or change Production.\n\n## Exact production contract\n\n- Uses the weekday-specific Played Universe from the current production source of truth.\n- Calls \`buildProductionGlobalWeekdayWin\`; no parallel scoring implementation.\n- Same weekday only, at most 12 prior observations per lottery.\n- Equal-source aggregation and available-side equal weighting.\n- Selects the first 6 digits from the Production ranking.\n- Target and future draws are excluded from training.\n- Historical runs ignore today's provider suspension/freshness state; current state is not back-propagated.\n- Outcomes are complete top2+bottom2 draws from the same Played Universe.\n- Exact random baseline enumerates all 210 Win 6 subsets separately for every outcome, including doubles and shared digits.\n- Confidence intervals use ${BOOTSTRAPS.toLocaleString("en-US")} target-date clustered bootstrap resamples.\n\n## Results\n\n- Evaluated dates: **${summary.dates}** (${rows[0].date} to ${rows.at(-1)!.date})\n- Complete outcomes: **${summary.outcomes}**\n\n| Metric | Production | Exact random | Uplift | Clustered 95% CI of uplift |\n|---|---:|---:|---:|---:|\n${metricRows}\n\n## Monthly consistency - primary either-side metric\n\n| Month | Dates | Outcomes | Production | Exact random | Uplift |\n|---|---:|---:|---:|---:|---:|\n${monthRows}\n\n## Decision\n\n**${decision}**\n\nThe primary metric is full two-digit coverage on either top or bottom. Retrospective evidence alone does not establish a future probability claim. A positive interval would require confirmation on independent, untouched future data before any predictive wording.\n\n## Change boundary\n\n- Production formula changed: **NO**\n- Weights/window/source lists changed: **NO**\n- Analyze UI changed by this study: **NO**\n- Candidate search performed: **NO**\n`;

await fs.mkdir(path.join(process.cwd(), "reports"), { recursive: true });
await Promise.all([
  fs.writeFile(path.join(process.cwd(), "reports", `${REPORT_NAME}.json`), `${JSON.stringify(result, null, 2)}\n`, "utf8"),
  fs.writeFile(path.join(process.cwd(), "reports", `${REPORT_NAME}.md`), report, "utf8"),
]);
console.log(JSON.stringify({ report: `reports/${REPORT_NAME}.md`, protocolHash, historyHash, data: result.data, summary, confidence: intervals, decision }, null, 2));
