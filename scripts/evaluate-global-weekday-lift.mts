import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { readAllSnapshots } from "../src/lib/cache";
import { getCanonicalDataset } from "../src/lib/history-provider";
import { drawWeekday } from "../src/lib/analysis/day-pattern";
import {
  digitRecall,
  eligibleGlobalWeekdaySources,
  exactRandomBothCoverage,
  exactRandomPairCoverage,
  pairCovered,
  rankGlobalWeekdayMethod,
  type GlobalWeekdayMethod,
  type GlobalWeekdaySource,
} from "../src/lib/analysis/global-weekday-evaluation";

const METHODS: { id: GlobalWeekdayMethod; name: string }[] = [
    { id: "weekday-frequency", name: "พบบ่อยตามวัน" },
    { id: "weekday-lift", name: "เด่นกว่าวันอื่น" },
    { id: "all-days-frequency", name: "ความถี่รวมทุกวัน" },
  ],
  SIZES = [5, 6, 7] as const,
  WEEKDAY_LOOKBACK = 12,
  ALL_DAYS_LOOKBACK = 84,
  MIN_WEEKDAY_DRAWS = 4,
  MIN_ALL_DAYS_DRAWS = 28,
  MIN_TRAINING_LOTTERIES = 10,
  MIN_TARGET_LOTTERIES = 10,
  BOOTSTRAPS = 10000,
  SEED = 20260901;

type DateRow = {
  date: string;
  weekday: number;
  method: GlobalWeekdayMethod;
  size: number;
  digits: string[];
  trainingLotteries: number;
  n: number;
  topHits: number;
  bottomHits: number;
  bothHits: number;
  recallSum: number;
  topExpected: number;
  bottomExpected: number;
  bothExpected: number;
};

const snapshots = await readAllSnapshots(),
  sources: GlobalWeekdaySource[] = Object.values(snapshots).map((snapshot) => ({
    lotteryId: snapshot.lotteryId,
    draws: getCanonicalDataset(snapshot, 1000).analysisHistory.filter((draw) => draw.top2 && draw.bottom2),
  })),
  dates = [...new Set(sources.flatMap((source) => source.draws.map((draw) => draw.drawDate)))].sort(),
  rows: DateRow[] = [];

for (const date of dates) {
  const weekday = drawWeekday(date) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    training = eligibleGlobalWeekdaySources(sources, {
      weekday,
      cutoffDate: date,
      weekdayLookback: WEEKDAY_LOOKBACK,
      allDaysLookback: ALL_DAYS_LOOKBACK,
      minimumWeekdayDraws: MIN_WEEKDAY_DRAWS,
      minimumAllDaysDraws: MIN_ALL_DAYS_DRAWS,
    }),
    targets = sources.flatMap((source) => source.draws.filter((draw) => draw.drawDate === date && draw.top2 && draw.bottom2));
  if (training.length < MIN_TRAINING_LOTTERIES || targets.length < MIN_TARGET_LOTTERIES) continue;
  for (const method of METHODS) {
    const ranking = rankGlobalWeekdayMethod(sources, method.id, {
      weekday,
      cutoffDate: date,
      weekdayLookback: WEEKDAY_LOOKBACK,
      allDaysLookback: ALL_DAYS_LOOKBACK,
      minimumWeekdayDraws: MIN_WEEKDAY_DRAWS,
      minimumAllDaysDraws: MIN_ALL_DAYS_DRAWS,
    });
    if (ranking.length !== 10) continue;
    for (const size of SIZES) {
      const selected = ranking.slice(0, size).map((item) => item.digit),
        topHits = targets.filter((draw) => pairCovered(selected, draw.top2!)).length,
        bottomHits = targets.filter((draw) => pairCovered(selected, draw.bottom2!)).length,
        bothHits = targets.filter((draw) => pairCovered(selected, draw.top2!) && pairCovered(selected, draw.bottom2!)).length;
      rows.push({
        date,
        weekday,
        method: method.id,
        size,
        digits: selected,
        trainingLotteries: training.length,
        n: targets.length,
        topHits,
        bottomHits,
        bothHits,
        recallSum: targets.reduce((total, draw) => total + digitRecall(selected, [draw.top2!, draw.bottom2!]), 0),
        topExpected: targets.reduce((total, draw) => total + exactRandomPairCoverage(draw.top2!, size), 0),
        bottomExpected: targets.reduce((total, draw) => total + exactRandomPairCoverage(draw.bottom2!, size), 0),
        bothExpected: targets.reduce((total, draw) => total + exactRandomBothCoverage(draw.top2!, draw.bottom2!, size), 0),
      });
    }
  }
}

const eligibleDates = [...new Set(rows.map((row) => row.date))].sort(),
  holdoutStart = Math.floor(eligibleDates.length * 0.75),
  developmentDates = new Set(eligibleDates.slice(0, holdoutStart)),
  holdoutDates = new Set(eligibleDates.slice(holdoutStart));

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function interval(items: { numerator: number; denominator: number }[], seedOffset = 0) {
  if (!items.length) return { low: 0, high: 0 };
  const random = seeded(SEED + seedOffset), values: number[] = [];
  for (let repetition = 0; repetition < BOOTSTRAPS; repetition += 1) {
    let numerator = 0, denominator = 0;
    for (let index = 0; index < items.length; index += 1) {
      const item = items[Math.floor(random() * items.length)];
      numerator += item.numerator; denominator += item.denominator;
    }
    values.push(denominator ? numerator / denominator : 0);
  }
  values.sort((a, b) => a - b);
  return { low: values[Math.floor(BOOTSTRAPS * 0.025)], high: values[Math.floor(BOOTSTRAPS * 0.975)] };
}

function summarize(method: GlobalWeekdayMethod, size: number, dateSet: Set<string>) {
  const sample = rows.filter((row) => row.method === method && row.size === size && dateSet.has(row.date)),
    n = sample.reduce((total, row) => total + row.n, 0),
    sideHits = sample.reduce((total, row) => total + row.topHits + row.bottomHits, 0),
    sideExpected = sample.reduce((total, row) => total + row.topExpected + row.bottomExpected, 0),
    bothHits = sample.reduce((total, row) => total + row.bothHits, 0),
    bothExpected = sample.reduce((total, row) => total + row.bothExpected, 0),
    recall = sample.reduce((total, row) => total + row.recallSum, 0),
    randomDiff = sample.map((row) => ({ numerator: row.topHits + row.bottomHits - row.topExpected - row.bottomExpected, denominator: row.n * 2 }));
  return {
    dates: sample.length,
    outcomes: n,
    sidePairRate: n ? sideHits / (n * 2) : 0,
    sideRandomRate: n ? sideExpected / (n * 2) : 0,
    sideRandomUplift: n ? (sideHits - sideExpected) / (n * 2) : 0,
    sideRandomCi: interval(randomDiff, size * 10 + METHODS.findIndex((item) => item.id === method)),
    topRate: n ? sample.reduce((total, row) => total + row.topHits, 0) / n : 0,
    bottomRate: n ? sample.reduce((total, row) => total + row.bottomHits, 0) / n : 0,
    bothRate: n ? bothHits / n : 0,
    bothRandomRate: n ? bothExpected / n : 0,
    recallRate: n ? recall / n : 0,
  };
}

function compare(first: GlobalWeekdayMethod, second: GlobalWeekdayMethod, size: number, dateSet: Set<string>) {
  const firstRows = new Map(rows.filter((row) => row.method === first && row.size === size && dateSet.has(row.date)).map((row) => [row.date, row])),
    pairs = rows.filter((row) => row.method === second && row.size === size && dateSet.has(row.date) && firstRows.has(row.date)).map((secondRow) => {
      const firstRow = firstRows.get(secondRow.date)!;
      return { numerator: firstRow.topHits + firstRow.bottomHits - secondRow.topHits - secondRow.bottomHits, denominator: firstRow.n * 2, weekday: firstRow.weekday };
    }),
    numerator = pairs.reduce((total, row) => total + row.numerator, 0),
    denominator = pairs.reduce((total, row) => total + row.denominator, 0);
  return { uplift: denominator ? numerator / denominator : 0, ci: interval(pairs, size * 100 + 7), pairs };
}

const pct = (value: number) => `${(value * 100).toFixed(2)}%`,
  signed = (value: number) => `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}pp`,
  sections = [
    { id: "development", dates: developmentDates },
    { id: "holdout", dates: holdoutDates },
    { id: "all", dates: new Set(eligibleDates) },
  ],
  results = Object.fromEntries(sections.map((section) => [section.id, Object.fromEntries(SIZES.map((size) => [size, Object.fromEntries(METHODS.map((method) => [method.id, summarize(method.id, size, section.dates)]))]))])),
  comparisons = Object.fromEntries(sections.map((section) => [section.id, Object.fromEntries(SIZES.map((size) => [size, compare("weekday-lift", "weekday-frequency", size, section.dates)]))])),
  holdoutWeekdayWins = Object.fromEntries(SIZES.map((size) => {
    const comparison = comparisons.holdout[size], grouped = Array.from({ length: 7 }, (_, weekday) => {
      const items = comparison.pairs.filter((row) => row.weekday === weekday), numerator = items.reduce((total, row) => total + row.numerator, 0), denominator = items.reduce((total, row) => total + row.denominator, 0);
      return denominator ? numerator / denominator : null;
    });
    return [size, grouped];
  })),
  promotion = Object.fromEntries(SIZES.map((size) => {
    const lift = results.holdout[size]["weekday-lift"], versusCurrent = comparisons.holdout[size], weekdayValues = holdoutWeekdayWins[size].filter((value): value is number => value !== null),
      passed = lift.sideRandomCi.low > 0 && versusCurrent.ci.low > 0 && weekdayValues.filter((value) => value > 0).length >= 4 && Math.min(...weekdayValues) >= -0.03;
    return [size, { passed, randomCi: lift.sideRandomCi, versusCurrentCi: versusCurrent.ci, positiveWeekdays: weekdayValues.filter((value) => value > 0).length, evaluatedWeekdays: weekdayValues.length, worstWeekday: weekdayValues.length ? Math.min(...weekdayValues) : 0 }];
  })),
  promotedSizes = SIZES.filter((size) => promotion[size].passed),
  decision = promotedSizes.length ? `PROMOTE sizes ${promotedSizes.join(", ")}` : "RESEARCH_ONLY_NO_PROMOTION",
  protocol = JSON.stringify({ METHODS, SIZES, WEEKDAY_LOOKBACK, ALL_DAYS_LOOKBACK, MIN_WEEKDAY_DRAWS, MIN_ALL_DAYS_DRAWS, MIN_TRAINING_LOTTERIES, MIN_TARGET_LOTTERIES, BOOTSTRAPS, SEED }),
  protocolHash = createHash("sha256").update(protocol).digest("hex").slice(0, 16),
  historyHash = createHash("sha256").update(Object.values(snapshots).sort((a, b) => a.lotteryId.localeCompare(b.lotteryId)).map((snapshot) => `${snapshot.lotteryId}:${snapshot.historyVersion}`).join("|")).digest("hex").slice(0, 16);

const table = (section: "development" | "holdout" | "all") => SIZES.flatMap((size) => METHODS.map((method) => {
    const result = results[section][size][method.id], versus = method.id === "weekday-lift" ? comparisons[section][size] : null;
    return `| ${size} | ${method.name} | ${result.dates} | ${result.outcomes} | ${pct(result.sidePairRate)} | ${pct(result.sideRandomRate)} | ${signed(result.sideRandomUplift)} | ${signed(result.sideRandomCi.low)} to ${signed(result.sideRandomCi.high)} | ${pct(result.bothRate)} | ${pct(result.recallRate)} | ${versus ? `${signed(versus.uplift)} (${signed(versus.ci.low)} to ${signed(versus.ci.high)})` : "—"} |`;
  })).join("\n"),
  report = `# Global weekday lift walk-forward study

Freeze date: 2026-09-01  
Protocol fingerprint: \`${protocolHash}\`  
History fingerprint: \`${historyHash}\`

## Frozen protocol

- One shared digit set per calendar date, evaluated against every complete lottery result on that date.
- Every ranking uses only draws with \`drawDate < targetDate\`; the target date and future are excluded.
- Weekday history: up to ${WEEKDAY_LOOKBACK} matching weekdays per lottery; all-days reference: up to ${ALL_DAYS_LOOKBACK} prior draws per lottery.
- Minimum training: ${MIN_WEEKDAY_DRAWS} matching weekdays and ${MIN_ALL_DAYS_DRAWS} all-days draws per lottery, at least ${MIN_TRAINING_LOTTERIES} training lotteries and ${MIN_TARGET_LOTTERIES} target lotteries.
- Top2 and bottom2 have equal weight. Each lottery has equal weight inside a ranking. Doubles count once for digit presence.
- Methods were fixed before result generation: weekday frequency (current), weekday lift (weekday rate minus all-days rate), and all-days frequency.
- Sizes: 5, 6, 7. Exact random baselines enumerate all equally likely digit subsets, including double-specific probabilities.
- Pair costs are fixed at 15, 21, and 28 pairs including doubles; exact random four-position recall is 50%, 60%, and 70% respectively.
- Primary metric: complete coverage of an actual top2 or bottom2 pair. Secondary: both sides covered and four-position digit recall.
- Confidence intervals: ${BOOTSTRAPS.toLocaleString()} deterministic bootstrap resamples clustered by target date, seed ${SEED}.
- Chronological split: oldest 75% development (${developmentDates.size} dates), newest 25% untouched holdout (${holdoutDates.size} dates).

## Development

| Win | Method | Dates | Outcomes | Side pair | Random | Uplift | Date-clustered 95% CI | Both sides | Digit recall | Lift vs current |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${table("development")}

## Final holdout

| Win | Method | Dates | Outcomes | Side pair | Random | Uplift | Date-clustered 95% CI | Both sides | Digit recall | Lift vs current |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${table("holdout")}

## All eligible walk-forward dates (descriptive)

| Win | Method | Dates | Outcomes | Side pair | Random | Uplift | Date-clustered 95% CI | Both sides | Digit recall | Lift vs current |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${table("all")}

## Frozen promotion gate

For a size to be promoted, holdout weekday lift must have: (1) CI above exact random, (2) paired CI above the current weekday-frequency method, (3) positive paired uplift on at least four weekdays, and (4) worst weekday no lower than -3pp.

${SIZES.map((size) => `- Win ${size}: **${promotion[size].passed ? "PASS" : "FAIL"}**; random CI ${signed(promotion[size].randomCi.low)} to ${signed(promotion[size].randomCi.high)}; versus current CI ${signed(promotion[size].versusCurrentCi.low)} to ${signed(promotion[size].versusCurrentCi.high)}; positive weekdays ${promotion[size].positiveWeekdays}/${promotion[size].evaluatedWeekdays}; worst weekday ${signed(promotion[size].worstWeekday)}.`).join("\n")}

## Decision

**${decision}**

No production formula, weight, or Analyze option is changed by this study. A positive point estimate without the frozen consistency gates is not treated as predictive evidence.
`;

await fs.mkdir(path.join(process.cwd(), "reports"), { recursive: true });
await Promise.all([
  fs.writeFile(path.join(process.cwd(), "reports", "global-weekday-lift-study.md"), report, "utf8"),
  fs.writeFile(path.join(process.cwd(), "reports", "global-weekday-lift-study.json"), JSON.stringify({ protocol: JSON.parse(protocol), protocolHash, historyHash, eligibleDates, developmentDates: [...developmentDates], holdoutDates: [...holdoutDates], results, comparisons: Object.fromEntries(Object.entries(comparisons).map(([section, sizes]) => [section, Object.fromEntries(Object.entries(sizes).map(([size, value]) => [size, { uplift: value.uplift, ci: value.ci }]))])), holdoutWeekdayWins, promotion, decision }, null, 2), "utf8"),
]);
console.log(JSON.stringify({ protocolHash, historyHash, dates: eligibleDates.length, developmentDates: developmentDates.size, holdoutDates: holdoutDates.size, decision, promotion, report: "reports/global-weekday-lift-study.md" }, null, 2));
