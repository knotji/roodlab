import { promises as fs } from "node:fs";
import path from "node:path";
import { readAllSnapshots, readCatalog } from "../src/lib/cache";
import { getCanonicalDataset } from "../src/lib/history-provider";
import { backtest } from "../src/lib/analysis/backtest";
import {
  ALL_STANDOUT_PAIRS,
  bootstrapPairedUplift,
  combinatorialRandomHitProbability,
  enumeratedRandomHitProbability,
  pairedUplift,
  standoutTarget,
  type PairedObservation,
} from "../src/lib/analysis/standout-baseline";
const algorithms = [
    { id: "balanced-v1", name: "Balanced v1" },
    { id: "momentum", name: "Momentum" },
    { id: "recent-weighted", name: "Recent Weighted" },
  ],
  snapshots = await readAllSnapshots(),
  catalog = await readCatalog(),
  eligible = Object.values(snapshots)
    .map((snapshot) => {
      const data = getCanonicalDataset(snapshot, 1000),
        history = [...data.analysisHistory].sort((a, b) =>
          a.drawDate.localeCompare(b.drawDate),
        );
      return {
        snapshot,
        data,
        history,
        holdoutStart: Math.floor(history.length * 0.75),
      };
    })
    .filter((x) => x.history.length >= 80)
    .sort((a, b) => a.snapshot.lotteryId.localeCompare(b.snapshot.lotteryId)),
  nameOf = (id: string) => catalog.find((x) => x.id === id)?.name ?? id;
type StudyRow = {
  algorithmId: string;
  lotteryId: string;
  drawDate: string;
  standout: string[];
  target: ReturnType<typeof standoutTarget>;
  outcome: 0 | 1;
  expected: number;
};
const rows: StudyRow[] = [];
for (const algorithm of algorithms)
  for (const item of eligible) {
    const holdoutCount = item.history.length - item.holdoutStart,
      evaluated = backtest(item.history, 30, holdoutCount, 4, algorithm.id);
    for (const row of evaluated) {
      const expected = enumeratedRandomHitProbability(row.draw),
        shortcut = combinatorialRandomHitProbability(row.draw);
      if (Math.abs(expected - shortcut) > 1e-12)
        throw new Error(
          `baseline mismatch ${item.snapshot.lotteryId} ${row.draw.drawDate}`,
        );
      rows.push({
        algorithmId: algorithm.id,
        lotteryId: item.snapshot.lotteryId,
        drawDate: row.draw.drawDate,
        standout: row.standout,
        target: standoutTarget(row.draw),
        outcome: row.standoutHit ? 1 : 0,
        expected,
      });
    }
  }
const stats = (
  algorithmId: string,
  subset = rows.filter((x) => x.algorithmId === algorithmId),
) => {
  const paired: PairedObservation[] = subset.map((x) => ({
      outcome: x.outcome,
      expected: x.expected,
      lotteryId: x.lotteryId,
    })),
    summary = pairedUplift(paired),
    ci = bootstrapPairedUplift(paired),
    perLottery = eligible.map((item) => {
      const sample = subset.filter(
          (x) => x.lotteryId === item.snapshot.lotteryId,
        ),
        s = pairedUplift(sample);
      return {
        id: item.snapshot.lotteryId,
        name: nameOf(item.snapshot.lotteryId),
        ...s,
      };
    }),
    uplifts = perLottery.map((x) => x.uplift).sort((a, b) => a - b),
    q = (p: number) => uplifts[Math.floor((uplifts.length - 1) * p)],
    tolerance = 0.02;
  return {
    ...summary,
    ci,
    above: perLottery.filter((x) => x.uplift > tolerance).length,
    approximately: perLottery.filter((x) => Math.abs(x.uplift) <= tolerance)
      .length,
    below: perLottery.filter((x) => x.uplift < -tolerance).length,
    medianLotteryUplift: q(0.5),
    worstQuartileUplift: q(0.25),
    bestQuartileUplift: q(0.75),
    perLottery,
  };
};
const results = Object.fromEntries(algorithms.map((x) => [x.id, stats(x.id)])),
  balancedRows = rows.filter((x) => x.algorithmId === "balanced-v1"),
  uniqueGroups = Array.from(
    new Set(balancedRows.map((x) => x.target.uniqueDigitCount)),
  )
    .sort((a, b) => a - b)
    .map((k) => {
      const sample = balancedRows.filter(
          (x) => x.target.uniqueDigitCount === k,
        ),
        base = pairedUplift(sample),
        algorithmRates = Object.fromEntries(
          algorithms.map((a) => {
            const s = pairedUplift(
              rows.filter(
                (x) =>
                  x.algorithmId === a.id && x.target.uniqueDigitCount === k,
              ),
            );
            return [a.id, { observedRate: s.observedRate, uplift: s.uplift }];
          }),
        );
      return {
        k,
        n: sample.length,
        baseline: base.baselineRate,
        algorithmRates,
      };
    }),
  fieldGroups = Array.from(
    new Set(balancedRows.map((x) => x.target.sourceFields.join("+"))),
  ).map((fields) => {
    const sample = balancedRows.filter(
        (x) => x.target.sourceFields.join("+") === fields,
      ),
      base = pairedUplift(sample);
    return {
      fields,
      n: sample.length,
      baseline: base.baselineRate,
      balanced: base.observedRate,
      momentum: pairedUplift(
        rows.filter(
          (x) =>
            x.algorithmId === "momentum" &&
            x.target.sourceFields.join("+") === fields,
        ),
      ).observedRate,
    };
  }),
  examples = balancedRows.slice(0, 3).map((x) => {
    const hits = ALL_STANDOUT_PAIRS.filter((pair) =>
      pair.split("").some((d) => x.target.digits.includes(d)),
    ).length;
    return {
      lotteryId: x.lotteryId,
      drawDate: x.drawDate,
      target: x.target.digits.join(", "),
      pairs: hits,
      baseline: x.expected,
      standout: x.standout.join(" · "),
      hit: Boolean(x.outcome),
    };
  }),
  pct = (x: number) => `${(x * 100).toFixed(2)}%`,
  signed = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(2)}pp`;
const aggregateTable = algorithms
    .map((a) => {
      const x = results[a.id];
      return `| ${a.name} | ${x.n} | ${pct(x.observedRate)} | ${pct(x.baselineRate)} | ${signed(x.uplift)} | ${x.excessHits.toFixed(1)} | ${signed(x.ci.low)} to ${signed(x.ci.high)} | ${x.z.toFixed(2)} |`;
    })
    .join("\n"),
  lotteryTable = eligible
    .map((item) => {
      const b = results["balanced-v1"].perLottery.find(
          (x) => x.id === item.snapshot.lotteryId,
        )!,
        m = results.momentum.perLottery.find(
          (x) => x.id === item.snapshot.lotteryId,
        )!;
      return `| ${item.snapshot.lotteryId} | ${b.n} | ${pct(b.baselineRate)} | ${pct(b.observedRate)} | ${signed(b.uplift)} | ${pct(m.observedRate)} | ${signed(m.uplift)} |`;
    })
    .join("\n"),
  uniqueTable = uniqueGroups
    .map(
      (x) =>
        `| ${x.k} | ${x.n} | ${pct(x.baseline)} | ${pct(x.algorithmRates["balanced-v1"].observedRate)} | ${signed(x.algorithmRates["balanced-v1"].uplift)} | ${pct(x.algorithmRates.momentum.observedRate)} | ${signed(x.algorithmRates.momentum.uplift)} |`,
    )
    .join("\n"),
  exampleText = examples
    .map(
      (x) =>
        `- \`${x.lotteryId}\` ${x.drawDate}: target {${x.target}}; ${x.pairs}/45 random pairs hit = ${pct(x.baseline)}; Balanced selected ${x.standout} → ${x.hit ? "hit" : "miss"}.`,
    )
    .join("\n"),
  versions = eligible
    .map((x) => `- \`${x.snapshot.lotteryId}\`: \`${x.data.historyVersion}\``)
    .join("\n");
const interpretation =
  results.momentum.ci.low > 0 &&
  results.momentum.above > eligible.length / 2 &&
  results.momentum.worstQuartileUplift >= -0.02
    ? "Interesting but inconclusive: aggregate uplift is positive, but cross-lottery downside is not strong enough to establish a robust predictive advantage."
    : "No meaningful evidence: the evaluated standout ranking does not establish stable uplift over the exact random baseline.";
const report = `# Standout random-baseline study\n\nFreeze date: 2026-08-27\n\n## Production hit definition\n\nThe production metric selects two distinct standout digits. It inspects the concatenation of \`top3\` and \`bottom2\`; \`top2\` is not inspected separately. Positions do not matter. Duplicate outcome digits collapse for baseline purposes. A hit occurs when either selected digit appears at least once. Missing fields contribute no digits; this study uses canonical complete draws only. The implementation is shared by production backtest and this evaluator.\n\n## Exact baseline\n\nAll 45 unordered distinct pairs from 0–9 are enumerated. For a target containing k unique digits, enumeration is asserted equal to \`1 - C(10-k,2)/C(10,2)\` per draw. Expected random hits are summed per draw; no Monte Carlo baseline is used.\n\n## Evaluation protocol\n\nReused the Core study's newest 25% holdout for ${eligible.length} lotteries (${balancedRows.length} draws per algorithm), with a 30-draw strictly prior training window. Algorithms were frozen: Balanced v1, Momentum, Recent Weighted. Bootstrap CI uses paired excess \`y_i-p_i\`, seed 20260827, 10,000 resamples.\n\n## Aggregate\n\n| Algorithm | N | Observed | Exact baseline | Uplift | Excess hits | Bootstrap 95% CI | z |\n|---|---:|---:|---:|---:|---:|---:|---:|\n${aggregateTable}\n\n## Lottery consistency (tolerance ±2pp)\n\n- Balanced: above ${results["balanced-v1"].above}, approximately baseline ${results["balanced-v1"].approximately}, below ${results["balanced-v1"].below}; median uplift ${signed(results["balanced-v1"].medianLotteryUplift)}; worst quartile ${signed(results["balanced-v1"].worstQuartileUplift)}.\n- Momentum: above ${results.momentum.above}, approximately baseline ${results.momentum.approximately}, below ${results.momentum.below}; median uplift ${signed(results.momentum.medianLotteryUplift)}; worst quartile ${signed(results.momentum.worstQuartileUplift)}.\n\n| Lottery | N | Baseline | Balanced | Uplift | Momentum | Uplift |\n|---|---:|---:|---:|---:|---:|---:|\n${lotteryTable}\n\n## Field availability\n\n${fieldGroups.map((x) => `- ${x.fields}: n=${x.n}, baseline ${pct(x.baseline)}, Balanced ${pct(x.balanced)}, Momentum ${pct(x.momentum)}.`).join("\n")}\n\n## Unique target digits\n\n| k | N | Baseline | Balanced | Uplift | Momentum | Uplift |\n|---:|---:|---:|---:|---:|---:|---:|\n${uniqueTable}\n\n## Sanity examples\n\n${exampleText}\n\n## Interpretation\n\n${interpretation}\n\nRecommended product copy: **เลขที่โดดเด่นจากสถิติย้อนหลัง**. Do not use probability, confidence, or prediction-confidence language.\n\n## FORMULA RESEARCH FROZEN\n\nBalanced v1 remains default. No algorithm weights or definitions were changed. Further formula changes require genuinely unseen draws arriving after 2026-08-27.\n\nProspective protocol: keep algorithms frozen; accumulate at least 30 new complete draws per lottery where feasible; evaluate Balanced v1 and Momentum sequentially using only prior draws; compare each outcome with its exact per-draw 45-pair baseline; publish all eligible lotteries and do not auto-promote.\n\n## History versions\n\n${versions}\n`;
await fs.mkdir(path.join(process.cwd(), "reports"), { recursive: true });
await fs.writeFile(
  path.join(process.cwd(), "reports", "standout-random-baseline-study.md"),
  report,
  "utf8",
);
console.log(
  JSON.stringify(
    {
      lotteries: eligible.map((x) => x.snapshot.lotteryId),
      draws: balancedRows.length,
      results,
      fieldGroups,
      uniqueGroups,
      interpretation,
      report: "reports/standout-random-baseline-study.md",
    },
    null,
    2,
  ),
);
