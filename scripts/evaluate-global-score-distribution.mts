import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import nextEnv from "@next/env";
import { GLOBAL_DAILY_SOURCE_IDS, curatedGlobalSources } from "../src/lib/analysis/global-daily-sources";
import { drawWeekday } from "../src/lib/analysis/day-pattern";
import { digitRecall, exactRandomBothCoverage, exactRandomPairCoverage, pairCovered } from "../src/lib/analysis/global-weekday-evaluation";
import { buildGlobalWeekdayWin, GLOBAL_WEEKDAY_LOOKBACK } from "../src/lib/analysis/global-weekday-win";
import { readAllSnapshots } from "../src/lib/cache";
import type { LotteryDraw } from "../src/lib/types";

const FREEZE_DATE = "2026-09-03", WIN_SIZE = 6, MIN_TARGET_LOTTERIES = 10, BOOTSTRAPS = 10_000, SEED = 20260903,
  REPORT_BASE = "global-score-distribution-2026-09-03";
nextEnv.loadEnvConfig(process.cwd());
const BUCKETS = [{ id: "rank1to3", label: "Rank 1–3", start: 0, end: 3 }, { id: "rank4to6", label: "Rank 4–6", start: 3, end: 6 }, { id: "rank7to10", label: "Rank 7–10", start: 6, end: 10 }] as const;
type BucketId = typeof BUCKETS[number]["id"];
type Source = { lotteryId: string; historyVersion: string; draws: LotteryDraw[] };
type BucketCounts = Record<BucketId, { top: number; bottom: number }>;
type DateRow = {
  date: string; gap: number; top6Spread: number; allSpread: number; entropy: number; concentration: number;
  outcomes: number; topHits: number; bottomHits: number; eitherHits: number; bothHits: number;
  expectedTop: number; expectedBottom: number; expectedEither: number; expectedBoth: number; buckets: BucketCounts;
};

const protocol = {
  freezeDate: FREEZE_DATE, pool: [...GLOBAL_DAILY_SOURCE_IDS], poolSize: 46,
  productionContract: { ranking: "overall", winSize: WIN_SIZE, weekdayOnly: true, weekdayLookback: GLOBAL_WEEKDAY_LOOKBACK, topWeight: 0.5, bottomWeight: 0.5, perLotteryNormalization: true, presencePerDraw: true },
  diagnostic: { rank6To7Gap: "score(rank 6) - score(rank 7)", top6Spread: "score(rank 1) - score(rank 6)", allDigitSpread: "score(rank 1) - score(rank 10)", normalizedEntropy: "Shannon entropy of non-negative scores divided by ln(10)", concentration: "1 - normalizedEntropy" },
  evaluation: { walkForward: true, targetExcluded: true, minimumTargetLotteries: MIN_TARGET_LOTTERIES, chronologicalDevelopmentShare: 0.75, gapBands: "development tertiles applied unchanged to holdout", bootstrap: { iterations: BOOTSTRAPS, cluster: "target date", seed: SEED } },
  labelGate: "Labels require monotonic low-to-high side-pair uplift in development and holdout plus a holdout high-minus-low bootstrap CI entirely above zero.",
  prohibition: "Validation only; no ranking, weighting, window, pool, strategy, or production interpretation change.",
} as const;

function seeded(seed: number) { let state = seed >>> 0; return () => ((state = (1664525 * state + 1013904223) >>> 0) / 4294967296); }
function percentile(values: number[], probability: number) {
  const sorted = [...values].sort((a, b) => a - b), index = (sorted.length - 1) * probability, lower = Math.floor(index), upper = Math.ceil(index), weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}
function mean(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function correlation(xs: number[], ys: number[]) {
  if (xs.length < 2) return 0;
  const mx = mean(xs), my = mean(ys), numerator = xs.reduce((sum, x, index) => sum + (x - mx) * (ys[index] - my), 0),
    left = Math.sqrt(xs.reduce((sum, x) => sum + (x - mx) ** 2, 0)), right = Math.sqrt(ys.reduce((sum, y) => sum + (y - my) ** 2, 0));
  return left && right ? numerator / (left * right) : 0;
}
function pct(value: number) { return `${(value * 100).toFixed(2)}%`; }
function pp(value: number) { return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}pp`; }
function fixed(value: number) { return value.toFixed(4); }

function coverage(rows: DateRow[]) {
  const outcomes = rows.reduce((sum, row) => sum + row.outcomes, 0), denominator = 2 * outcomes,
    top = rows.reduce((sum, row) => sum + row.topHits, 0) / outcomes,
    bottom = rows.reduce((sum, row) => sum + row.bottomHits, 0) / outcomes,
    sidePair = rows.reduce((sum, row) => sum + row.topHits + row.bottomHits, 0) / denominator,
    either = rows.reduce((sum, row) => sum + row.eitherHits, 0) / outcomes,
    both = rows.reduce((sum, row) => sum + row.bothHits, 0) / outcomes,
    expectedTop = rows.reduce((sum, row) => sum + row.expectedTop, 0) / outcomes,
    expectedBottom = rows.reduce((sum, row) => sum + row.expectedBottom, 0) / outcomes,
    expectedSidePair = rows.reduce((sum, row) => sum + row.expectedTop + row.expectedBottom, 0) / denominator,
    expectedEither = rows.reduce((sum, row) => sum + row.expectedEither, 0) / outcomes,
    expectedBoth = rows.reduce((sum, row) => sum + row.expectedBoth, 0) / outcomes;
  return { dates: rows.length, outcomes, top, bottom, sidePair, either, both, expectedTop, expectedBottom, expectedSidePair, expectedEither, expectedBoth, sidePairUplift: sidePair - expectedSidePair };
}

function bootstrapMetric(rows: DateRow[], value: (sample: DateRow[]) => number, seedOffset = 0) {
  if (!rows.length) return [0, 0] as const;
  const random = seeded(SEED + seedOffset), samples = Array.from({ length: BOOTSTRAPS }, () => value(Array.from({ length: rows.length }, () => rows[Math.floor(random() * rows.length)])));
  return [percentile(samples, .025), percentile(samples, .975)] as const;
}

function bucketSummary(rows: DateRow[], bucket: typeof BUCKETS[number]) {
  const outcomes = rows.reduce((sum, row) => sum + row.outcomes, 0), denominator = 2 * outcomes, baseline = (bucket.end - bucket.start) / 10,
    top = rows.reduce((sum, row) => sum + row.buckets[bucket.id].top, 0) / denominator,
    bottom = rows.reduce((sum, row) => sum + row.buckets[bucket.id].bottom, 0) / denominator,
    combined = (top + bottom) / 2,
    uplift = combined - baseline,
    uplift95 = bootstrapMetric(rows, (sample) => bucketSummaryPoint(sample, bucket) - baseline, bucket.start + 20);
  return { outcomes, baseline, top, bottom, combined, uplift, uplift95 };
}
function bucketSummaryPoint(rows: DateRow[], bucket: typeof BUCKETS[number]) {
  const outcomes = rows.reduce((sum, row) => sum + row.outcomes, 0), denominator = 4 * outcomes;
  return rows.reduce((sum, row) => sum + row.buckets[bucket.id].top + row.buckets[bucket.id].bottom, 0) / denominator;
}

const snapshots = await readAllSnapshots(), sources = curatedGlobalSources(Object.values(snapshots)) as Source[];
if (sources.length !== GLOBAL_DAILY_SOURCE_IDS.length) throw new Error(`Exact curated pool required: found ${sources.length}/${GLOBAL_DAILY_SOURCE_IDS.length}`);
const dates = [...new Set(sources.flatMap((source) => source.draws.map((draw) => draw.drawDate)))].filter((date) => date <= FREEZE_DATE).sort(), rows: DateRow[] = [];

for (const date of dates) {
  const ranking = buildGlobalWeekdayWin(sources, { weekday: drawWeekday(date) as 0 | 1 | 2 | 3 | 4 | 5 | 6, cutoffDate: date }),
    targets = sources.flatMap((source) => source.draws.filter((draw) => draw.drawDate === date && draw.top2 && draw.bottom2));
  if (!ranking.sufficient || targets.length < MIN_TARGET_LOTTERIES) continue;
  const selected = ranking.rankedDigits.slice(0, WIN_SIZE).map((item) => item.digit), bucketDigits = Object.fromEntries(BUCKETS.map((bucket) => [bucket.id, new Set(ranking.rankedDigits.slice(bucket.start, bucket.end).map((item) => item.digit))])) as Record<BucketId, Set<string>>,
    row: DateRow = { date, gap: ranking.scoreDistribution.rank6To7Gap, top6Spread: ranking.scoreDistribution.top6Spread, allSpread: ranking.scoreDistribution.allDigitSpread, entropy: ranking.scoreDistribution.normalizedEntropy, concentration: ranking.scoreDistribution.concentration, outcomes: targets.length, topHits: 0, bottomHits: 0, eitherHits: 0, bothHits: 0, expectedTop: 0, expectedBottom: 0, expectedEither: 0, expectedBoth: 0, buckets: Object.fromEntries(BUCKETS.map((bucket) => [bucket.id, { top: 0, bottom: 0 }])) as BucketCounts };
  for (const draw of targets) {
    const top = pairCovered(selected, draw.top2!), bottom = pairCovered(selected, draw.bottom2!), expectedTop = exactRandomPairCoverage(draw.top2!, WIN_SIZE), expectedBottom = exactRandomPairCoverage(draw.bottom2!, WIN_SIZE), expectedBoth = exactRandomBothCoverage(draw.top2!, draw.bottom2!, WIN_SIZE);
    row.topHits += Number(top); row.bottomHits += Number(bottom); row.eitherHits += Number(top || bottom); row.bothHits += Number(top && bottom);
    row.expectedTop += expectedTop; row.expectedBottom += expectedBottom; row.expectedBoth += expectedBoth; row.expectedEither += expectedTop + expectedBottom - expectedBoth;
    for (const bucket of BUCKETS) {
      row.buckets[bucket.id].top += digitRecall([...bucketDigits[bucket.id]], [draw.top2!]) * 2;
      row.buckets[bucket.id].bottom += digitRecall([...bucketDigits[bucket.id]], [draw.bottom2!]) * 2;
    }
  }
  rows.push(row);
}
if (rows.length < 8) throw new Error(`Insufficient walk-forward dates: ${rows.length}`);

const splitIndex = Math.floor(rows.length * .75), development = rows.slice(0, splitIndex), holdout = rows.slice(splitIndex),
  lowCut = percentile(development.map((row) => row.gap), 1 / 3), highCut = percentile(development.map((row) => row.gap), 2 / 3),
  band = (row: DateRow) => row.gap <= lowCut ? "low" : row.gap <= highCut ? "middle" : "high",
  bandRows = (set: DateRow[], id: "low" | "middle" | "high") => set.filter((row) => band(row) === id),
  bandResults = Object.fromEntries(["development", "holdout", "all"].map((section) => {
    const set = section === "development" ? development : section === "holdout" ? holdout : rows;
    return [section, Object.fromEntries((["low", "middle", "high"] as const).map((id) => [id, coverage(bandRows(set, id))]))];
  })),
  holdoutDifference = coverage(bandRows(holdout, "high")).sidePairUplift - coverage(bandRows(holdout, "low")).sidePairUplift,
  holdoutDifference95 = (() => {
    const high = bandRows(holdout, "high"), low = bandRows(holdout, "low"), random = seeded(SEED + 100), samples: number[] = [];
    for (let iteration = 0; iteration < BOOTSTRAPS; iteration += 1) {
      const sample = (set: DateRow[]) => Array.from({ length: set.length }, () => set[Math.floor(random() * set.length)]);
      samples.push(coverage(sample(high)).sidePairUplift - coverage(sample(low)).sidePairUplift);
    }
    return [percentile(samples, .025), percentile(samples, .975)] as const;
  })(),
  dateUplift = (row: DateRow) => coverage([row]).sidePairUplift,
  correlationResult = (set: DateRow[], offset: number) => {
    const value = correlation(set.map((row) => row.gap), set.map(dateUplift)), ci = bootstrapMetric(set, (sample) => correlation(sample.map((row) => row.gap), sample.map(dateUplift)), offset);
    return { value, ci };
  },
  gapCorrelation = { development: correlationResult(development, 200), holdout: correlationResult(holdout, 201), all: correlationResult(rows, 202) },
  monotonic = (section: "development" | "holdout") => {
    const values = (["low", "middle", "high"] as const).map((id) => bandResults[section][id].sidePairUplift);
    return values[0] <= values[1] && values[1] <= values[2];
  },
  labelsJustified = monotonic("development") && monotonic("holdout") && holdoutDifference95[0] > 0,
  gapDistribution = { min: Math.min(...rows.map((row) => row.gap)), p25: percentile(rows.map((row) => row.gap), .25), median: percentile(rows.map((row) => row.gap), .5), p75: percentile(rows.map((row) => row.gap), .75), max: Math.max(...rows.map((row) => row.gap)), mean: mean(rows.map((row) => row.gap)) },
  diagnosticSummary = { gap: gapDistribution, top6SpreadMean: mean(rows.map((row) => row.top6Spread)), allSpreadMean: mean(rows.map((row) => row.allSpread)), entropyMean: mean(rows.map((row) => row.entropy)), concentrationMean: mean(rows.map((row) => row.concentration)) },
  bucketResults = Object.fromEntries(["development", "holdout", "all"].map((section) => {
    const set = section === "development" ? development : section === "holdout" ? holdout : rows;
    return [section, Object.fromEntries(BUCKETS.map((bucket) => [bucket.id, bucketSummary(set, bucket)]))];
  })),
  protocolHash = createHash("sha256").update(JSON.stringify(protocol)).digest("hex").slice(0, 16), historyHash = createHash("sha256").update(sources.map((source) => `${source.lotteryId}:${source.historyVersion}`).sort().join("|")).digest("hex").slice(0, 16),
  result = { protocol, protocolHash, historyHash, dataPeriod: { first: rows[0].date, last: rows.at(-1)!.date }, sample: { dates: rows.length, developmentDates: development.length, holdoutDates: holdout.length, outcomes: coverage(rows).outcomes }, diagnosticSummary, gapBands: { developmentTertileCuts: { lowCut, highCut }, results: bandResults, holdoutHighMinusLowUplift: holdoutDifference, holdoutHighMinusLow95: holdoutDifference95, correlation: gapCorrelation }, rankBuckets: bucketResults, labelsJustified, conclusion: labelsJustified ? "Score concentration showed stable holdout separation under the frozen gate." : "No stable evidence that score concentration should change interpretation of the Top 6." };

const bandTable = (section: "development" | "holdout") => (["low", "middle", "high"] as const).map((id) => { const item = bandResults[section][id]; return `| ${id} | ${item.dates} | ${item.outcomes} | ${pct(item.sidePair)} | ${pct(item.expectedSidePair)} | ${pp(item.sidePairUplift)} | ${pct(item.either)} |`; }).join("\n"),
  bucketTable = (section: "development" | "holdout" | "all") => BUCKETS.map((bucket) => { const item = bucketResults[section][bucket.id]; return `| ${bucket.label} | ${bucket.end - bucket.start} | ${pct(item.top)} | ${pct(item.bottom)} | ${pct(item.combined)} | ${pct(item.baseline)} | ${pp(item.uplift)} | ${pp(item.uplift95[0])} to ${pp(item.uplift95[1])} |`; }).join("\n"),
  report = `# Global Win 6 score-distribution diagnostic\n\nFreeze date: ${FREEZE_DATE}  \nProtocol fingerprint: \`${protocolHash}\`  \nHistory fingerprint: \`${historyHash}\`\n\n## Protocol\n\n- Exact frozen production ranking: curated 46 lotteries, same weekday, maximum 12 prior same-weekday observations per lottery, presence per draw, per-lottery normalization, top/bottom 50:50, overall Top 6.\n- Target and future draws are excluded. No weights, windows, pool membership, strategies, or production interpretation were tuned.\n- Gap bands use development-only tertiles and are applied unchanged to the chronological holdout.\n- Labels require monotonic low-to-high side-pair uplift in development and holdout plus a holdout high-minus-low target-date bootstrap CI entirely above zero.\n- Rank-bucket recall is normalized per digit position. Random expectations are 30%, 30%, and 40% for bucket sizes 3, 3, and 4.\n- Pair baselines use exact combinatorial probabilities with double handling. Confidence intervals use ${BOOTSTRAPS.toLocaleString("en-US")} target-date clustered resamples.\n\n## Data\n\n- Period: ${rows[0].date} to ${rows.at(-1)!.date}\n- Walk-forward dates: ${rows.length} (${development.length} development / ${holdout.length} holdout)\n- Complete target outcomes: ${coverage(rows).outcomes}\n\n## Score-distribution metrics\n\n- Rank 6–7 gap: min ${fixed(gapDistribution.min)}, p25 ${fixed(gapDistribution.p25)}, median ${fixed(gapDistribution.median)}, p75 ${fixed(gapDistribution.p75)}, max ${fixed(gapDistribution.max)}, mean ${fixed(gapDistribution.mean)}.\n- Mean Top-6 spread: ${fixed(diagnosticSummary.top6SpreadMean)}.\n- Mean all-digit spread: ${fixed(diagnosticSummary.allSpreadMean)}.\n- Mean normalized entropy: ${fixed(diagnosticSummary.entropyMean)} (1 = flat).\n- Mean concentration: ${fixed(diagnosticSummary.concentrationMean)} (0 = flat).\n- Development gap cuts: low <= ${fixed(lowCut)}; middle <= ${fixed(highCut)}; otherwise high.\n\n## Gap-band results\n\n### Development\n\n| Gap band | Dates | Outcomes | Side-pair hit | Exact random | Uplift | Either-side hit |\n|---|---:|---:|---:|---:|---:|---:|\n${bandTable("development")}\n\n### Holdout\n\n| Gap band | Dates | Outcomes | Side-pair hit | Exact random | Uplift | Either-side hit |\n|---|---:|---:|---:|---:|---:|---:|\n${bandTable("holdout")}\n\n- Holdout high-minus-low side-pair uplift: ${pp(holdoutDifference)}; 95% CI ${pp(holdoutDifference95[0])} to ${pp(holdoutDifference95[1])}.\n- Gap/date-level uplift correlation: development ${gapCorrelation.development.value.toFixed(3)} (${gapCorrelation.development.ci[0].toFixed(3)} to ${gapCorrelation.development.ci[1].toFixed(3)}); holdout ${gapCorrelation.holdout.value.toFixed(3)} (${gapCorrelation.holdout.ci[0].toFixed(3)} to ${gapCorrelation.holdout.ci[1].toFixed(3)}).\n\n## Ranking bucket analysis\n\n### Development\n\n| Bucket | Digits | Top recall | Bottom recall | Combined | Random | Uplift | 95% CI uplift |\n|---|---:|---:|---:|---:|---:|---:|---:|\n${bucketTable("development")}\n\n### Holdout\n\n| Bucket | Digits | Top recall | Bottom recall | Combined | Random | Uplift | 95% CI uplift |\n|---|---:|---:|---:|---:|---:|---:|---:|\n${bucketTable("holdout")}\n\n### All dates (descriptive)\n\n| Bucket | Digits | Top recall | Bottom recall | Combined | Random | Uplift | 95% CI uplift |\n|---|---:|---:|---:|---:|---:|---:|---:|\n${bucketTable("all")}\n\n## Label decision\n\nLabels justified: **${labelsJustified ? "YES" : "NO"}**.\n\n**${result.conclusion}**\n\n${labelsJustified ? "A minimal descriptive label may be considered; it must not affect ranking." : "No production concentration label or threshold is added. UI may expose only the mathematically raw rank 6–7 score gap."}\n\n## Contract confirmation\n\n- Production formula changed: **none**.\n- Prospective tracking added: **none**.\n- Decision: **FROZEN_DIAGNOSTIC_ONLY_NO_TUNING**.\n`;

async function freezeFile(file: string, content: string) {
  try { const existing = await fs.readFile(file, "utf8"); if (existing !== content) throw new Error(`Frozen report already exists with different content: ${file}`); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; await fs.writeFile(file, content, "utf8"); }
}
const reportDir = path.join(process.cwd(), "reports"); await fs.mkdir(reportDir, { recursive: true });
await freezeFile(path.join(reportDir, `${REPORT_BASE}.json`), `${JSON.stringify(result, null, 2)}\n`);
await freezeFile(path.join(reportDir, `${REPORT_BASE}.md`), report);
console.log(JSON.stringify({ report: `reports/${REPORT_BASE}.md`, protocolHash, historyHash, sample: result.sample, gap: diagnosticSummary.gap, holdoutHighMinusLowUplift: holdoutDifference, holdoutHighMinusLow95: holdoutDifference95, labelsJustified, conclusion: result.conclusion }, null, 2));
