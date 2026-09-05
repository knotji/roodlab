import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import nextEnv from "@next/env";
import { drawWeekday } from "../src/lib/analysis/day-pattern";
import { evaluateRankConsensusOutcome } from "../src/lib/analysis/global-rank-consensus-study";
import { exactRandomBothCoverage, exactRandomPairCoverage } from "../src/lib/analysis/global-weekday-evaluation";
import {
  buildGlobalWeekdayWinForUniverse,
  LEGACY_GLOBAL_46_SOURCE_IDS,
  resolvePlayedUniverseTargets,
  type GlobalUniverseMode,
} from "../src/lib/analysis/global-universe";
import { GLOBAL_WEEKDAY_LOOKBACK } from "../src/lib/analysis/global-weekday-win";
import { resolvePlayedUniverseSourceIds } from "../src/lib/analysis/played-universe";
import { readAllSnapshots, readCatalog, readCatalogAudit, type Snapshot } from "../src/lib/cache";
import { AllHuayDataSource } from "../src/lib/data-sources/allhuay";
import type { LotteryDraw } from "../src/lib/types";

const FREEZE_DATE = "2026-09-05", HEAD = "25d75de", WIN_SIZE = 6, MIN_TARGET_LOTTERIES = 10, BOOTSTRAPS = 10_000, SEED = 20260905,
  TIE_EPSILON = 0.005, WEEKDAY = 6 as const, REPORT_BASE = "global-played-universe-2026-09-05",
  PLAYED_POOL = [...resolvePlayedUniverseSourceIds(WEEKDAY)], LEGACY_POOL = [...LEGACY_GLOBAL_46_SOURCE_IDS],
  HYDRATION_POOL = [...new Set([...PLAYED_POOL, ...LEGACY_POOL])],
  MODES: readonly GlobalUniverseMode[] = ["all_eligible", "legacy_46", "played"];

const protocol = {
  freezeDate: FREEZE_DATE,
  codeBaseline: `main@${HEAD}`,
  researchQuestion: "Which source universe (dynamic All Eligible, frozen Legacy 46, or weekday-scoped Played Universe) produces the best Win 6 for the lotteries actually played on Saturday?",
  scoringEngine: "src/lib/analysis/global-weekday-win.ts#buildGlobalWeekdayWin - identical for every strategy, unmodified by this study",
  universes: {
    all_eligible: { source: "dynamic canonical catalog, same resolver production uses", note: "identical to /api/global-weekday-win in production" },
    legacy_46: { source: "src/lib/analysis/global-daily-sources.ts#GLOBAL_DAILY_SOURCE_IDS (frozen)", size: LEGACY_POOL.length, ids: LEGACY_POOL },
    played: { source: "src/lib/analysis/played-universe.ts#PLAYED_UNIVERSE_BY_WEEKDAY[6] (frozen, user-provided operational list)", size: PLAYED_POOL.length, ids: PLAYED_POOL },
  },
  weekdayScope: "Saturday only - the only weekday with a real user-provided operational list as of this freeze date. Monday-Friday and Sunday are not evaluated.",
  commonData: { sameWeekdayOnly: true, maximumPriorObservationsPerLottery: GLOBAL_WEEKDAY_LOOKBACK, targetAndFutureExcluded: true, presencePerDraw: true, duplicateDigitCountedOncePerSide: true, noImputation: true, equalSourceWeighting: true },
  targetPopulation: "Fixed per date: the Played Universe intersected with sources that report a complete top2 and bottom2 outcome on the target date. Identical for all three strategies - each strategy is graded on the same outcomes, never on its own universe.",
  primaryMetric: "full two-digit hit on either top2 or bottom2 (played-universe outcomes only)",
  secondaryMetrics: ["full top2 hit", "full bottom2 hit", "both-sides full hit", "digit recall"],
  randomBaseline: "exact enumeration of all 6-of-10 sets with double-aware pair coverage",
  split: { development: "oldest 75% eligible Saturday target dates", holdout: "newest 25% eligible Saturday target dates" },
  bootstrap: { iterations: BOOTSTRAPS, cluster: "target date", seed: SEED },
  decisionRule: {
    researchSupportedIf: [
      "Played improves over All Eligible in Development, Holdout, and All",
      "Played improves over or approximately ties Legacy 46 (within a 0.5pp tie band)",
      "the paired-difference 95% CI vs All Eligible excludes zero on the low side",
    ],
    tieEpsilon: TIE_EPSILON,
    preRegisteredNote: "This decision rule was fixed before reading results. No weekday list, weight, or window size is tuned based on this study's outcome.",
  },
  prohibition: "One frozen comparison only; no tuning of played-universe lists, no production, UI, pool, or scoring change is authorized by this study.",
} as const;

if (PLAYED_POOL.length === 0) throw new Error("Played Universe for Saturday is empty - nothing to evaluate.");
if (new Set(PLAYED_POOL).size !== PLAYED_POOL.length) throw new Error("Played Universe for Saturday contains duplicate ids.");
const protocolHash = createHash("sha256").update(JSON.stringify(protocol)).digest("hex").slice(0, 16);

type MetricKey = "top" | "bottom" | "either" | "both" | "recall";
type Totals = Record<MetricKey, number>;
type StrategyTotals = Record<GlobalUniverseMode, Totals>;
type DateRow = { date: string; outcomes: number; totals: StrategyTotals; expected: Totals; universeSizes: Record<GlobalUniverseMode, number> };

const zero = (): Totals => ({ top: 0, bottom: 0, either: 0, both: 0, recall: 0 });
function add(total: Totals, value: { top: boolean; bottom: boolean; either: boolean; both: boolean; recall: number }) {
  total.top += Number(value.top); total.bottom += Number(value.bottom); total.either += Number(value.either); total.both += Number(value.both); total.recall += value.recall;
}
function baseline(top2: string, bottom2: string): Totals {
  const top = exactRandomPairCoverage(top2, WIN_SIZE), bottom = exactRandomPairCoverage(bottom2, WIN_SIZE), both = exactRandomBothCoverage(top2, bottom2, WIN_SIZE);
  return { top, bottom, either: top + bottom - both, both, recall: 0.6 };
}
function mean(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function seeded(seed: number) { let state = seed >>> 0; return () => ((state = (1664525 * state + 1013904223) >>> 0) / 4294967296); }
function percentile(values: number[], p: number) { const sorted = [...values].sort((a, b) => a - b), index = (sorted.length - 1) * p, lo = Math.floor(index), hi = Math.ceil(index), w = index - lo; return sorted[lo] * (1 - w) + sorted[hi] * w; }

function aggregate(rows: readonly DateRow[]) {
  const outcomes = rows.reduce((sum, row) => sum + row.outcomes, 0),
    sum = (mode: GlobalUniverseMode | "expected", key: MetricKey) => rows.reduce((total, row) => total + (mode === "expected" ? row.expected[key] : row.totals[mode][key]), 0),
    metrics = (mode: GlobalUniverseMode) => Object.fromEntries((Object.keys(zero()) as MetricKey[]).map((key) => {
      const rate = outcomes ? sum(mode, key) / outcomes : 0, random = outcomes ? sum("expected", key) / outcomes : 0;
      return [key, { rate, baseline: random, uplift: rate - random }];
    })) as Record<MetricKey, { rate: number; baseline: number; uplift: number }>,
    pairedVsAllEligible = outcomes ? (sum("played", "either") - sum("all_eligible", "either")) / outcomes : 0,
    pairedVsLegacy46 = outcomes ? (sum("played", "either") - sum("legacy_46", "either")) / outcomes : 0;
  return { dates: rows.length, outcomes, all_eligible: metrics("all_eligible"), legacy_46: metrics("legacy_46"), played: metrics("played"), pairedVsAllEligible, pairedVsLegacy46 };
}
function bootstrap(rows: readonly DateRow[], seed: number) {
  const random = seeded(seed), pairedVsAllEligible: number[] = [], pairedVsLegacy46: number[] = [];
  for (let i = 0; i < BOOTSTRAPS; i += 1) {
    const sample = Array.from({ length: rows.length }, () => rows[Math.floor(random() * rows.length)]), value = aggregate(sample);
    pairedVsAllEligible.push(value.pairedVsAllEligible); pairedVsLegacy46.push(value.pairedVsLegacy46);
  }
  const ci = (v: number[]) => [percentile(v, .025), percentile(v, .975)] as [number, number];
  return { pairedVsAllEligible95: ci(pairedVsAllEligible), pairedVsLegacy46: ci(pairedVsLegacy46) };
}

nextEnv.loadEnvConfig(process.cwd());
const catalog = await readCatalog(), audit = await readCatalogAudit(), cachedSnapshots = await readAllSnapshots(),
  provider = new AllHuayDataSource(catalog),
  missing = HYDRATION_POOL.filter((id) => !cachedSnapshots[id]?.draws?.length),
  hydrated = await Promise.all(missing.map(async (lotteryId): Promise<{ lotteryId: string; draws: LotteryDraw[] }> => {
    const result = await provider.getCanonicalHistory(lotteryId, { limit: 100 });
    if (!result.draws.length) throw new Error(`No historical draws returned for ${lotteryId}`);
    return { lotteryId, draws: result.draws };
  })),
  snapshots: Record<string, Snapshot> = { ...cachedSnapshots };
for (const source of hydrated) snapshots[source.lotteryId] = { lotteryId: source.lotteryId, syncedAt: new Date().toISOString(), source: "AllHuay", draws: source.draws };

for (const id of PLAYED_POOL) if (!catalog.some((lottery) => lottery.id === id)) throw new Error(`Played-universe id missing from canonical catalog: ${id}`);
for (const id of PLAYED_POOL) if (!snapshots[id]?.draws?.length) throw new Error(`No history available for played-universe id: ${id}`);

const playedCatalogEntries = catalog.filter((lottery) => PLAYED_POOL.includes(lottery.id)),
  dates = [...new Set(playedCatalogEntries.flatMap((lottery) => (snapshots[lottery.id]?.draws ?? []).map((draw) => draw.drawDate)))]
    .filter((date) => date <= FREEZE_DATE && drawWeekday(date) === WEEKDAY)
    .sort(),
  rows: DateRow[] = [];

for (const date of dates) {
  const targets = resolvePlayedUniverseTargets({ catalog, snapshots, weekday: WEEKDAY, date });
  if (targets.length < MIN_TARGET_LOTTERIES) continue;

  const perMode = Object.fromEntries(MODES.map((mode) => [mode, buildGlobalWeekdayWinForUniverse({ mode, catalog, snapshots, targetDate: date, weekday: WEEKDAY, historical: true, audit })])) as Record<GlobalUniverseMode, ReturnType<typeof buildGlobalWeekdayWinForUniverse>>;
  if (!MODES.every((mode) => perMode[mode].result.sufficient || mode === "played")) continue; // all_eligible / legacy_46 must be self-sufficient; played is graded even if thin, but still scored by the same engine

  const totals: StrategyTotals = { all_eligible: zero(), legacy_46: zero(), played: zero() }, expected = zero();
  for (const target of targets) {
    for (const mode of MODES) {
      const digits = perMode[mode].result.digits.slice(0, WIN_SIZE).map((item) => item.digit);
      add(totals[mode], evaluateRankConsensusOutcome(digits, target.top2, target.bottom2));
    }
    const random = baseline(target.top2, target.bottom2);
    (Object.keys(random) as MetricKey[]).forEach((key) => { expected[key] += random[key]; });
  }
  rows.push({ date, outcomes: targets.length, totals, expected, universeSizes: Object.fromEntries(MODES.map((mode) => [mode, perMode[mode].universeCatalogSize])) as Record<GlobalUniverseMode, number> });
}
if (rows.length < 6) throw new Error(`Insufficient walk-forward Saturday dates: ${rows.length}`);

const splitIndex = Math.floor(rows.length * .75), developmentRows = rows.slice(0, splitIndex), holdoutRows = rows.slice(splitIndex),
  sections = { development: aggregate(developmentRows), holdout: aggregate(holdoutRows), all: aggregate(rows) },
  confidence = { development: bootstrap(developmentRows, SEED + 1), holdout: bootstrap(holdoutRows, SEED + 2), all: bootstrap(rows, SEED) },
  historyHash = createHash("sha256").update(Object.entries(snapshots).filter(([id]) => HYDRATION_POOL.includes(id) || catalog.some((l) => l.id === id)).map(([id, snap]) => `${id}:${snap.draws.length}:${snap.draws[0]?.drawDate ?? ""}`).sort().join("|")).digest("hex").slice(0, 16),
  avgUniverseSize = (mode: GlobalUniverseMode) => mean(rows.map((row) => row.universeSizes[mode]));

const all = sections.all, allCi = confidence.all,
  improvesOverAllEligible = sections.development.pairedVsAllEligible > 0 && sections.holdout.pairedVsAllEligible > 0 && sections.all.pairedVsAllEligible > 0,
  ciSupportsAllEligible = allCi.pairedVsAllEligible95[0] > 0,
  tiesOrBeatsLegacy46 = sections.all.pairedVsLegacy46 >= -TIE_EPSILON,
  conclusion: "RESEARCH-SUPPORTED" | "INCONCLUSIVE" | "REJECT" =
    improvesOverAllEligible && tiesOrBeatsLegacy46 && ciSupportsAllEligible
      ? "RESEARCH-SUPPORTED"
      : sections.all.pairedVsAllEligible <= 0 && sections.all.pairedVsLegacy46 <= -TIE_EPSILON
        ? "REJECT"
        : "INCONCLUSIVE";

const pct = (v: number) => `${(v * 100).toFixed(2)}%`, pp = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(2)}pp`, ci = (v: [number, number]) => `${pp(v[0])} to ${pp(v[1])}`,
  sectionRows = (["development", "holdout", "all"] as const).map((key) => {
    const s = sections[key], c = confidence[key];
    return `| ${key} | ${s.dates} | ${s.outcomes} | ${pct(s.all_eligible.either.rate)} | ${pct(s.legacy_46.either.rate)} | ${pct(s.played.either.rate)} | ${pct(s.all_eligible.either.baseline)} | ${pp(s.pairedVsAllEligible)} | ${ci(c.pairedVsAllEligible95)} | ${pp(s.pairedVsLegacy46)} | ${ci(c.pairedVsLegacy46)} |`;
  }).join("\n"),
  secondaryRows = (["top", "bottom", "either", "both", "recall"] as MetricKey[]).map((key) =>
    `| ${key} | ${pct(all.all_eligible[key].rate)} | ${pct(all.legacy_46[key].rate)} | ${pct(all.played[key].rate)} | ${pct(all.all_eligible[key].baseline)} |`,
  ).join("\n"),
  universeRow = MODES.map((mode) => `| ${mode} | ${avgUniverseSize(mode).toFixed(1)} |`).join("\n");

const report = `# Global Played Universe study (Saturday only)

Freeze date: ${FREEZE_DATE}
Code baseline: \`main@${HEAD}\`
Protocol fingerprint: \`${protocolHash}\`
History fingerprint: \`${historyHash}\`

## Research question

${protocol.researchQuestion}

## Scope

${protocol.weekdayScope}

## Universes compared

- **All Eligible**: ${protocol.universes.all_eligible.note}.
- **Legacy 46**: frozen, \`${protocol.universes.legacy_46.source}\`, ${LEGACY_POOL.length} ids.
- **Played**: frozen, \`${protocol.universes.played.source}\`, ${PLAYED_POOL.length} ids: ${PLAYED_POOL.map((id) => `\`${id}\``).join(", ")}.

Average resolved universe size (post target-date eligibility, mean over evaluated dates):

| Universe | Avg. eligible sources |
|---|---:|
${universeRow}

## Frozen protocol

- All three strategies call the **same, unmodified** \`buildGlobalWeekdayWin\` scoring engine with equal-source weighting and at most ${GLOBAL_WEEKDAY_LOOKBACK} prior same-weekday observations per lottery.
- The only difference between strategies is which canonical lotteries reach the eligibility/scoring pipeline (\`resolveUniverseCatalog\` in \`src/lib/analysis/global-universe.ts\`).
- ${protocol.targetPopulation}
- Primary metric: ${protocol.primaryMetric}. Exact random baseline enumerates all 6-of-10 sets and handles doubles exactly.
- Chronological split: oldest 75% Development, newest 25% Holdout. Confidence intervals use ${BOOTSTRAPS.toLocaleString("en-US")} target-date clustered bootstrap iterations.
- Decision rule pre-registered before reading results: ${protocol.decisionRule.researchSupportedIf.join("; ")}.
- ${protocol.prohibition}

## Data

- Saturday target dates evaluated: ${rows.length} (range ${rows[0].date} to ${rows.at(-1)!.date})
- Complete played-universe outcomes: ${all.outcomes}
- Live-hydrated (read-only) sources: ${hydrated.map((source) => source.lotteryId).join(", ") || "none"}

## Primary result - primary metric (full 2-digit hit, either side)

| Section | Dates | Outcomes | All Eligible | Legacy 46 | Played | Random | Played - All Eligible | 95% CI | Played - Legacy 46 | 95% CI |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${sectionRows}

## Secondary metrics - all data

| Metric | All Eligible | Legacy 46 | Played | Random |
|---|---:|---:|---:|---:|
${secondaryRows}

## Conclusion

**${conclusion}**

- Played vs All Eligible, paired difference (all data): ${pp(all.pairedVsAllEligible)}, 95% CI ${ci(allCi.pairedVsAllEligible95)}
- Played vs Legacy 46, paired difference (all data): ${pp(all.pairedVsLegacy46)}, 95% CI ${ci(allCi.pairedVsLegacy46)}
- Development/Holdout direction vs All Eligible: ${pp(sections.development.pairedVsAllEligible)} / ${pp(sections.holdout.pairedVsAllEligible)}

## Limitations

- Saturday-only history yields a thin sample (${rows.length} target dates); confidence intervals are wide and this is not a high-power result.
- Monday-Friday and Sunday Played Universe lists are not populated and are not evaluated here.
- Retrospective analysis does not establish future predictive advantage.
- Related sources can be correlated; date-clustered bootstrap reflects date variation only.

## Contract confirmation

- Production formula changed: **NO**
- Production universe/pool changed: **NO**
- Production UI changed: **NO**
- Weekday lists tuned from this result: **NO**
- Production promotion authorized: **NO**
`;

async function freezeFile(file: string, content: string) {
  try {
    const existing = await fs.readFile(file, "utf8");
    if (existing !== content) throw new Error(`Frozen report already exists with different content: ${file}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await fs.writeFile(file, content, "utf8");
  }
}
const result = { protocol, protocolHash, historyHash, pool: { all_eligible: null, legacy_46: LEGACY_POOL, played: PLAYED_POOL }, data: { range: [rows[0].date, rows.at(-1)!.date], targetDates: rows.length, outcomes: all.outcomes, hydrated: hydrated.map((source) => source.lotteryId) }, sections, confidence, conclusion };
const reportDir = path.join(process.cwd(), "reports");
await fs.mkdir(reportDir, { recursive: true });
await freezeFile(path.join(reportDir, `${REPORT_BASE}.json`), `${JSON.stringify(result, null, 2)}\n`);
await freezeFile(path.join(reportDir, `${REPORT_BASE}.md`), report);
console.log(JSON.stringify({ report: `reports/${REPORT_BASE}.md`, protocolHash, historyHash, data: result.data, sections, confidence, conclusion }, null, 2));
