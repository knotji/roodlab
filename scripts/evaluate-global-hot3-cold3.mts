import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import nextEnv from "@next/env";
import { FROZEN_GLOBAL_POOL_39 } from "./frozen-global-pool-39";
import { drawWeekday } from "../src/lib/analysis/day-pattern";
import { exactRandomBothCoverage, exactRandomPairCoverage } from "../src/lib/analysis/global-weekday-evaluation";
import { buildGlobalWeekdayWin, GLOBAL_WEEKDAY_LOOKBACK } from "../src/lib/analysis/global-weekday-win";
import { classifyPairedOutcome, evaluateStrategyOutcome, selectHot3Cold3, selectOverallTop6, type StrategyOutcome } from "../src/lib/analysis/global-hot-cold-study";
import { computeHistoryVersion, readAllSnapshots, readCatalog } from "../src/lib/cache";
import { AllHuayDataSource } from "../src/lib/data-sources/allhuay";
import type { LotteryDraw } from "../src/lib/types";

const FREEZE_DATE = "2026-09-03", MIN_TARGET_LOTTERIES = 10, BOOTSTRAPS = 10_000, SEED = 20260903,
  REPORT_BASE = "global-hot3-cold3-study-2026-09-03", POOL = [...FROZEN_GLOBAL_POOL_39];

const protocol = {
  freezeDate: FREEZE_DATE,
  codeBaseline: "main@37da122",
  universe: { source: "GLOBAL_DAILY_SOURCE_IDS", size: 39, ids: POOL },
  productionRanking: { sameWeekdayOnly: true, maximumPriorObservationsPerLottery: GLOBAL_WEEKDAY_LOOKBACK, presencePerDraw: true, normalizePerLotteryFirst: true, topBottomWeights: [0.5, 0.5], comparator: "production buildGlobalWeekdayWin comparator" },
  strategies: { overallTop6: { ranks: [1, 2, 3, 4, 5, 6] }, hot3Cold3: { ranks: [1, 2, 3, 8, 9, 10], rank7Excluded: true } },
  primaryMetric: "full two-digit hit on either top2 or bottom2",
  targets: { completeTop2AndBottom2Required: true, sameTargetsForBothStrategies: true, minimumLotteriesPerDate: MIN_TARGET_LOTTERIES, targetAndFutureExcluded: true },
  split: { development: "oldest 75% target dates", holdout: "newest 25% target dates" },
  randomBaseline: "exact enumeration of all 6-of-10 sets with double-aware pair coverage",
  bootstrap: { iterations: BOOTSTRAPS, cluster: "target date", seed: SEED },
  prohibition: "One pre-registered comparison only; no tuning or production change. Frozen 46-lottery studies are historical archives and are excluded from this experiment.",
} as const;

if (POOL.length !== 39 || new Set(POOL).size !== 39) throw new Error(`Pre-registered production pool mismatch: ${POOL.length}/39`);
const protocolHash = createHash("sha256").update(JSON.stringify(protocol)).digest("hex").slice(0, 16);

type Source = { lotteryId: string; historyVersion: string; draws: LotteryDraw[] };
type MetricKey = "top" | "bottom" | "either" | "both" | "recall";
type MetricTotals = Record<MetricKey, number>;
type Decomposition = Record<"both" | "overallOnly" | "hotColdOnly" | "neither", number>;
type DateRow = { date: string; outcomes: number; trainingLotteries: number; overall: MetricTotals; hotCold: MetricTotals; expected: MetricTotals; decomposition: Decomposition; rank4to6Recall: number; rank8to10Recall: number };

const zeroMetrics = (): MetricTotals => ({ top: 0, bottom: 0, either: 0, both: 0, recall: 0 });
const zeroDecomposition = (): Decomposition => ({ both: 0, overallOnly: 0, hotColdOnly: 0, neither: 0 });

function addOutcome(total: MetricTotals, outcome: StrategyOutcome) {
  total.top += Number(outcome.top); total.bottom += Number(outcome.bottom); total.either += Number(outcome.either); total.both += Number(outcome.both); total.recall += outcome.recall;
}

function exactBaseline(top2: string, bottom2: string): MetricTotals {
  const top = exactRandomPairCoverage(top2, 6), bottom = exactRandomPairCoverage(bottom2, 6), both = exactRandomBothCoverage(top2, bottom2, 6);
  return { top, bottom, either: top + bottom - both, both, recall: 0.6 };
}

function aggregate(rows: readonly DateRow[]) {
  const outcomes = rows.reduce((sum, row) => sum + row.outcomes, 0), sum = (field: "overall" | "hotCold" | "expected", key: MetricKey) => rows.reduce((total, row) => total + row[field][key], 0),
    metrics = (field: "overall" | "hotCold") => Object.fromEntries((["top", "bottom", "either", "both", "recall"] as MetricKey[]).map((key) => {
      const rate = outcomes ? sum(field, key) / outcomes : 0, baseline = outcomes ? sum("expected", key) / outcomes : 0;
      return [key, { rate, baseline, uplift: rate - baseline }];
    })) as Record<MetricKey, { rate: number; baseline: number; uplift: number }>;
  const decomposition = Object.fromEntries((Object.keys(zeroDecomposition()) as (keyof Decomposition)[]).map((key) => [key, rows.reduce((total, row) => total + row.decomposition[key], 0)])) as Decomposition;
  return {
    dates: rows.length, outcomes, overall: metrics("overall"), hotCold: metrics("hotCold"),
    pairedEitherDifference: outcomes ? (sum("hotCold", "either") - sum("overall", "either")) / outcomes : 0,
    decomposition,
    rankOccurrence: { rank4to6Recall: outcomes ? rows.reduce((total, row) => total + row.rank4to6Recall, 0) / outcomes : 0, rank8to10Recall: outcomes ? rows.reduce((total, row) => total + row.rank8to10Recall, 0) / outcomes : 0 },
  };
}

function seeded(seed: number) { let state = seed >>> 0; return () => ((state = (1664525 * state + 1013904223) >>> 0) / 4294967296); }
function percentile(values: number[], probability: number) { const sorted = [...values].sort((a, b) => a - b), index = (sorted.length - 1) * probability, lower = Math.floor(index), upper = Math.ceil(index), weight = index - lower; return sorted[lower] * (1 - weight) + sorted[upper] * weight; }
function bootstrap(rows: readonly DateRow[], seed: number) {
  const random = seeded(seed), overallUplift: number[] = [], hotColdUplift: number[] = [], pairedDifference: number[] = [];
  for (let iteration = 0; iteration < BOOTSTRAPS; iteration += 1) {
    const sample = Array.from({ length: rows.length }, () => rows[Math.floor(random() * rows.length)]), result = aggregate(sample);
    overallUplift.push(result.overall.either.uplift); hotColdUplift.push(result.hotCold.either.uplift); pairedDifference.push(result.pairedEitherDifference);
  }
  return { overallUplift95: [percentile(overallUplift, 0.025), percentile(overallUplift, 0.975)], hotColdUplift95: [percentile(hotColdUplift, 0.025), percentile(hotColdUplift, 0.975)], pairedDifference95: [percentile(pairedDifference, 0.025), percentile(pairedDifference, 0.975)] };
}

nextEnv.loadEnvConfig(process.cwd());
const snapshots = await readAllSnapshots(), productionSet = new Set<string>(POOL), stored = Object.values(snapshots).filter((source) => productionSet.has(source.lotteryId)) as Source[],
  missing = POOL.filter((id) => !stored.some((source) => source.lotteryId === id)), catalog = await readCatalog(), dataSource = new AllHuayDataSource(catalog),
  hydrated = await Promise.all(missing.map(async (lotteryId): Promise<Source> => { const result = await dataSource.getCanonicalHistory(lotteryId, { limit: 100 }); if (!result.draws.length) throw new Error(`No historical draws returned for ${lotteryId}`); return { lotteryId, draws: result.draws, historyVersion: computeHistoryVersion(lotteryId, result.draws) }; })),
  byId = new Map([...stored, ...hydrated].map((source) => [source.lotteryId, source])), sources = POOL.map((id) => byId.get(id)).filter((source): source is Source => Boolean(source));
if (sources.length !== 39) throw new Error(`Exact production pool unavailable: ${sources.length}/39`);

const historyHash = createHash("sha256").update(sources.map((source) => `${source.lotteryId}:${source.historyVersion}`).sort().join("|")).digest("hex").slice(0, 16),
  dates = [...new Set(sources.flatMap((source) => source.draws.map((draw) => draw.drawDate)))].filter((date) => date <= FREEZE_DATE).sort(), rows: DateRow[] = [];

for (const date of dates) {
  const ranking = buildGlobalWeekdayWin(sources, { weekday: drawWeekday(date) as 0 | 1 | 2 | 3 | 4 | 5 | 6, cutoffDate: date }),
    targets = sources.flatMap((source) => source.draws.filter((draw) => draw.drawDate === date && draw.top2 && draw.bottom2));
  if (!ranking.sufficient || targets.length < MIN_TARGET_LOTTERIES) continue;
  const overallDigits = selectOverallTop6(ranking.rankedDigits), hotColdDigits = selectHot3Cold3(ranking.rankedDigits), rank4to6 = ranking.rankedDigits.slice(3, 6).map((item) => item.digit), rank8to10 = ranking.rankedDigits.slice(7, 10).map((item) => item.digit),
    row: DateRow = { date, outcomes: targets.length, trainingLotteries: ranking.lotteryCount, overall: zeroMetrics(), hotCold: zeroMetrics(), expected: zeroMetrics(), decomposition: zeroDecomposition(), rank4to6Recall: 0, rank8to10Recall: 0 };
  for (const target of targets) {
    const top2 = target.top2!, bottom2 = target.bottom2!, overall = evaluateStrategyOutcome(overallDigits, top2, bottom2), hotCold = evaluateStrategyOutcome(hotColdDigits, top2, bottom2), expected = exactBaseline(top2, bottom2);
    addOutcome(row.overall, overall); addOutcome(row.hotCold, hotCold); (Object.keys(expected) as MetricKey[]).forEach((key) => { row.expected[key] += expected[key]; }); row.decomposition[classifyPairedOutcome(overall, hotCold)] += 1;
    row.rank4to6Recall += evaluateStrategyOutcome(rank4to6, top2, bottom2).recall; row.rank8to10Recall += evaluateStrategyOutcome(rank8to10, top2, bottom2).recall;
  }
  rows.push(row);
}
if (!rows.length) throw new Error("No eligible walk-forward dates");

const splitIndex = Math.floor(rows.length * 0.75), developmentRows = rows.slice(0, splitIndex), holdoutRows = rows.slice(splitIndex), sections = { development: aggregate(developmentRows), holdout: aggregate(holdoutRows), all: aggregate(rows) },
  confidence = { development: bootstrap(developmentRows, SEED + 1), holdout: bootstrap(holdoutRows, SEED + 2), all: bootstrap(rows, SEED) },
  months = Object.entries(Object.groupBy(rows, (row) => row.date.slice(0, 7))).map(([month, monthRows]) => ({ month, ...aggregate(monthRows ?? []) })),
  result = { protocol, protocolHash, historyHash, data: { range: [rows[0].date, rows.at(-1)!.date], storedSources: stored.length, readOnlyHydratedSources: hydrated.map((source) => source.lotteryId), targetDates: rows.length, outcomes: sections.all.outcomes }, sections, confidence, months };

const pct = (value: number) => `${(value * 100).toFixed(2)}%`, pp = (value: number) => `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}pp`, ci = (values: readonly number[]) => `${pp(values[0])} to ${pp(values[1])}`,
  sectionTable = (["development", "holdout", "all"] as const).map((key) => { const item = sections[key], uncertainty = confidence[key]; return `| ${key} | ${item.dates} | ${item.outcomes} | ${pct(item.overall.either.rate)} | ${pct(item.hotCold.either.rate)} | ${pct(item.overall.either.baseline)} | ${pp(item.overall.either.uplift)} | ${ci(uncertainty.overallUplift95)} | ${pp(item.hotCold.either.uplift)} | ${ci(uncertainty.hotColdUplift95)} | ${pp(item.pairedEitherDifference)} | ${ci(uncertainty.pairedDifference95)} |`; }).join("\n"),
  secondaryTable = (["top", "bottom", "either", "both", "recall"] as MetricKey[]).map((key) => `| ${key} | ${pct(sections.all.overall[key].rate)} | ${pct(sections.all.hotCold[key].rate)} | ${pct(sections.all.overall[key].baseline)} | ${pp(sections.all.overall[key].uplift)} | ${pp(sections.all.hotCold[key].uplift)} |`).join("\n"),
  monthTable = months.map((item) => `| ${item.month} | ${item.dates} | ${item.outcomes} | ${pct(item.overall.either.rate)} | ${pct(item.hotCold.either.rate)} | ${pp(item.pairedEitherDifference)} |`).join("\n"), all = sections.all, allCi = confidence.all,
  conclusion = allCi.pairedDifference95[0] <= 0 && allCi.pairedDifference95[1] >= 0 ? "No clear evidence that Hot3Cold3 differs from Overall Top 6; keep the simpler frozen production strategy." : all.pairedEitherDifference <= 0 ? "Hot3Cold3 did not improve the primary metric; keep Overall Top 6." : "The paired estimate is positive, but this remains a research finding only and does not authorize a production change.",
  report = `# Global Hot 3 + Cold 3 study\n\nFreeze date: ${FREEZE_DATE}  \nProtocol fingerprint: \`${protocolHash}\`  \nHistory fingerprint: \`${historyHash}\`\n\n## Research question\n\nDoes selecting digits from both extremes of the historical production ranking change out-of-sample coverage versus Overall Top 6? Hot and cold are historical rank labels only; no due-number interpretation is made.\n\n## Pre-registered protocol\n\n- Universe: exact current production pool at \`main@37da122\`: **39 lotteries** from \`GLOBAL_DAILY_SOURCE_IDS\`.\n- Previous frozen 46-lottery studies are historical archives. Their results are not combined with or used to select this conclusion.\n- Ranking: existing production \`buildGlobalWeekdayWin\`; same weekday; at most 12 prior matching weekdays per lottery; presence per draw; per-lottery normalization; top/bottom 50:50; unchanged deterministic comparator.\n- A Overall Top 6: ranks 1-6.\n- B Hot3Cold3: ranks 1-3 and 8-10; rank 7 intentionally excluded.\n- Primary metric: full two-digit hit on either top2 or bottom2.\n- Exact random baseline: all 210 six-of-ten sets, including double-aware coverage.\n- Development/holdout: oldest 75% / newest 25% of eligible target dates.\n- Uncertainty: ${BOOTSTRAPS.toLocaleString("en-US")} target-date cluster bootstrap iterations.\n- No other strategy, rank set, window, weight, or pool was evaluated.\n\n## Data\n\n- Range: ${result.data.range[0]} to ${result.data.range[1]}\n- Target dates: ${result.data.targetDates}\n- Complete target outcomes: ${result.data.outcomes}\n- Sources already stored: ${result.data.storedSources}/39\n- Read-only hydration: ${result.data.readOnlyHydratedSources.join(", ") || "none"}\n\nAbsolute rates are not directly comparable with previous 46-lottery reports because this study intentionally uses the current 39-lottery production universe.\n\n## Primary result\n\n| Section | Dates | Outcomes | Overall Top 6 | Hot3Cold3 | Exact random | A uplift | A uplift 95% CI | B uplift | B uplift 95% CI | Paired B - A | Paired 95% CI |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n${sectionTable}\n\n## Secondary metrics - all data\n\n| Metric | Overall Top 6 | Hot3Cold3 | Exact random | A uplift | B uplift |\n|---|---:|---:|---:|---:|---:|\n${secondaryTable}\n\nSecondary metrics are descriptive and are not used to select a strategy.\n\n## Paired outcome decomposition - all data\n\n- Both hit: **${all.decomposition.both}** (${pct(all.decomposition.both / all.outcomes)})\n- Overall Top 6 only: **${all.decomposition.overallOnly}** (${pct(all.decomposition.overallOnly / all.outcomes)})\n- Hot3Cold3 only: **${all.decomposition.hotColdOnly}** (${pct(all.decomposition.hotColdOnly / all.outcomes)})\n- Neither: **${all.decomposition.neither}** (${pct(all.decomposition.neither / all.outcomes)})\n\n## Unique-rank occurrence diagnostic\n\nDigit-position recall for the non-shared ranks, descriptive only:\n\n- Ranks 4-6: **${pct(all.rankOccurrence.rank4to6Recall)}**\n- Ranks 8-10: **${pct(all.rankOccurrence.rank8to10Recall)}**\n\nThis is out-of-sample occurrence, not evidence that low-ranked digits are due.\n\n## Time consistency\n\n| Month | Dates | Outcomes | Overall Top 6 | Hot3Cold3 | Paired B - A |\n|---|---:|---:|---:|---:|---:|\n${monthTable}\n\n## Conclusion\n\n**${conclusion}**\n\n## Limitations\n\n- Retrospective historical analysis cannot establish future predictive advantage.\n- Related lottery families may be correlated.\n- Month-level estimates can be noisy, especially when few target dates are eligible.\n- This is exactly one pre-registered comparison on the current 39-lottery universe.\n\n## Contract confirmation\n\n- Production formula changed: **NO**\n- Production UI changed: **NO**\n- Prospective tracking added: **NO**\n- Production promotion authorized: **NO**\n`;

async function freezeFile(file: string, content: string) { try { const existing = await fs.readFile(file, "utf8"); if (existing !== content) throw new Error(`Frozen report already exists with different content: ${file}`); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; await fs.writeFile(file, content, "utf8"); } }
const reportDir = path.join(process.cwd(), "reports"); await fs.mkdir(reportDir, { recursive: true }); await freezeFile(path.join(reportDir, `${REPORT_BASE}.json`), `${JSON.stringify(result, null, 2)}\n`); await freezeFile(path.join(reportDir, `${REPORT_BASE}.md`), report);
console.log(JSON.stringify({ report: `reports/${REPORT_BASE}.md`, protocolHash, historyHash, data: result.data, primary: { development: sections.development, holdout: sections.holdout, all: sections.all, confidence }, conclusion }, null, 2));
