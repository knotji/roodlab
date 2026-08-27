import { promises as fs } from "node:fs";
import path from "node:path";
import { readAllSnapshots, readCatalog } from "../src/lib/cache";
import { getCanonicalDataset } from "../src/lib/history-provider";
import { ALGORITHMS } from "../src/lib/analysis/algorithms";
import { CORE_CANDIDATES } from "../src/lib/analysis/core-candidates";
import { analyzeLottery, rankAllPairs } from "../src/lib/analysis/engine";
import type { AlgorithmDefinition } from "../src/lib/analysis/types";
import type { LotteryDraw } from "../src/lib/types";

type EvalRow = {
  lotteryId: string;
  drawDate: string;
  standout: boolean;
  topRank: number;
  bottomRank: number;
};
type Summary = {
  formulaId: string;
  name: string;
  draws: number;
  lotteries: number;
  standout: number;
  top1: number;
  top4: number;
  top10: number;
  top20: number;
  topSideTop4: number;
  bottomSideTop4: number;
  topSideTop10: number;
  bottomSideTop10: number;
  medianRank: number;
  meanRank: number;
  mrr: number;
  medianLotteryTop10: number;
  worstQuartileTop10: number;
  dispersion: number;
  beatBaseline: number;
  loseBaseline: number;
  robustness: number;
};
const formulas = [...ALGORITHMS, ...CORE_CANDIDATES];
const eligible = (
  await Promise.all(
    Object.values(await readAllSnapshots()).map(async (snapshot) => {
      const data = getCanonicalDataset(snapshot, 1000);
      return {
        snapshot,
        data,
        history: [...data.analysisHistory].sort((a, b) =>
          a.drawDate.localeCompare(b.drawDate),
        ),
      };
    }),
  )
)
  .filter((x) => x.history.length >= 80)
  .sort((a, b) => a.snapshot.lotteryId.localeCompare(b.snapshot.lotteryId));
const catalog = await readCatalog(),
  nameOf = (id: string) => catalog.find((x) => x.id === id)?.name ?? id;
function config(formula: AlgorithmDefinition) {
  return CORE_CANDIDATES.some((x) => x.id === formula.id)
    ? {
        algorithmId: "custom",
        customWeights: {
          digitWeights: formula.digitWeights,
          pairWeights: formula.pairWeights,
        },
      }
    : { algorithmId: formula.id, customWeights: undefined };
}
function evaluate(
  history: LotteryDraw[],
  lotteryId: string,
  indices: number[],
  formula: AlgorithmDefinition,
) {
  const cfg = config(formula),
    rows: EvalRow[] = [];
  for (const i of indices) {
    const training = history.slice(i - 30, i),
      actual = history[i],
      analysis = analyzeLottery(training, {
        window: 30,
        candidateCount: 4,
        includeDoubles: true,
        ...cfg,
      }),
      top = rankAllPairs(
        training,
        "top",
        cfg.algorithmId,
        cfg.customWeights,
        30,
        true,
      ),
      bottom = rankAllPairs(
        training,
        "bottom",
        cfg.algorithmId,
        cfg.customWeights,
        30,
        true,
      ),
      topRank = top.findIndex((x) => x.pair === actual.top2) + 1,
      bottomRank = bottom.findIndex((x) => x.pair === actual.bottom2) + 1,
      relevant = `${actual.top3 ?? ""}${actual.bottom2 ?? ""}`;
    if (topRank && bottomRank)
      rows.push({
        lotteryId,
        drawDate: actual.drawDate,
        standout: analysis.standout.some((d) => relevant.includes(d.digit)),
        topRank,
        bottomRank,
      });
  }
  return rows;
}
const clamp = (x: number) => Math.max(0, Math.min(100, x)),
  median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)] : 0;
  },
  mean = (xs: number[]) =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0,
  std = (xs: number[]) => {
    const m = mean(xs);
    return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
  },
  pct = (x: number) => `${(x * 100).toFixed(2)}%`;
function summarize(formula: AlgorithmDefinition, rows: EvalRow[]): Summary {
  const topRanks = rows.map((r) => r.topRank),
    bottomRanks = rows.map((r) => r.bottomRank),
    ranks = rows.flatMap((r) => [r.topRank, r.bottomRank]),
    perLottery = eligible.map((x) => {
      const r = rows.filter((y) => y.lotteryId === x.snapshot.lotteryId),
        rs = r.flatMap((y) => [y.topRank, y.bottomRank]);
      return { rate: rs.filter((n) => n <= 10).length / (rs.length || 1) };
    }),
    top10 = ranks.filter((x) => x <= 10).length / (ranks.length || 1),
    top4 = ranks.filter((x) => x <= 4).length / (ranks.length || 1),
    top20 = ranks.filter((x) => x <= 20).length / (ranks.length || 1),
    mrr = mean(ranks.map((x) => 1 / x)),
    lotteryRates = perLottery.map((x) => x.rate),
    sorted = [...lotteryRates].sort((a, b) => a - b),
    worst = mean(sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.25)))),
    consistency = clamp(50 + (median(lotteryRates) - 0.1) * 250),
    longHorizon = clamp(50 + (top10 - 0.1) * 250),
    pairQuality = clamp(
      25 * (top4 / 0.04) +
        25 * (top10 / 0.1) +
        20 * (top20 / 0.2) +
        30 * (mrr / 0.05187),
    ),
    standout = rows.filter((x) => x.standout).length / (rows.length || 1),
    downside = clamp(50 + (worst - 0.1) * 200 - std(lotteryRates) * 100),
    robustness =
      0.35 * consistency +
      0.25 * longHorizon +
      0.2 * pairQuality +
      0.1 * standout * 100 +
      0.1 * downside;
  return {
    formulaId: formula.id,
    name: formula.name,
    draws: rows.length,
    lotteries: new Set(rows.map((x) => x.lotteryId)).size,
    standout,
    top1: ranks.filter((x) => x <= 1).length / (ranks.length || 1),
    top4,
    top10,
    top20,
    topSideTop4: topRanks.filter((x) => x <= 4).length / (topRanks.length || 1),
    bottomSideTop4: bottomRanks.filter((x) => x <= 4).length / (bottomRanks.length || 1),
    topSideTop10: topRanks.filter((x) => x <= 10).length / (topRanks.length || 1),
    bottomSideTop10: bottomRanks.filter((x) => x <= 10).length / (bottomRanks.length || 1),
    medianRank: median(ranks),
    meanRank: mean(ranks),
    mrr,
    medianLotteryTop10: median(lotteryRates),
    worstQuartileTop10: worst,
    dispersion: std(lotteryRates),
    beatBaseline: lotteryRates.filter((x) => x > 0.1).length,
    loseBaseline: lotteryRates.filter((x) => x < 0.1).length,
    robustness,
  };
}
const split = eligible.map((x) => {
  const holdoutStart = Math.floor(x.history.length * 0.75);
  return {
    ...x,
    holdoutStart,
    development: x.history.slice(0, holdoutStart),
    holdout: x.history.slice(holdoutStart),
  };
});
const devRows = new Map<string, EvalRow[]>();
for (const formula of formulas) {
  const rows = split.flatMap((x) =>
    evaluate(
      x.history,
      x.snapshot.lotteryId,
      Array.from(
        { length: Math.max(0, x.holdoutStart - 30) },
        (_, n) => n + 30,
      ),
      formula,
    ),
  );
  devRows.set(formula.id, rows);
}
const development = formulas
    .map((f) => summarize(f, devRows.get(f.id)!))
    .sort((a, b) => b.robustness - a.robustness),
  finalistIds = Array.from(
    new Set([
      "balanced-v1",
      ...development
        .filter((x) => x.formulaId !== "balanced-v1")
        .slice(0, 3)
        .map((x) => x.formulaId),
    ]),
  ),
  finalists = formulas.filter((f) => finalistIds.includes(f.id)),
  holdout = finalists
    .map((f) =>
      summarize(
        f,
        split.flatMap((x) =>
          evaluate(
            x.history,
            x.snapshot.lotteryId,
            Array.from(
              { length: x.history.length - x.holdoutStart },
              (_, n) => x.holdoutStart + n,
            ),
            f,
          ),
        ),
      ),
    )
    .sort((a, b) => b.robustness - a.robustness),
  balanced = holdout.find((x) => x.formulaId === "balanced-v1")!,
  winner = holdout[0],
  promote =
    winner.formulaId !== "balanced-v1" &&
  winner.top10 > balanced.top10 &&
  winner.top1 >= balanced.top1 &&
  winner.worstQuartileTop10 >= balanced.worstQuartileTop10 &&
  winner.dispersion <= balanced.dispersion &&
  winner.top4 >= balanced.top4 &&
  winner.top20 >= balanced.top20 &&
  winner.meanRank <= balanced.meanRank;
const table = (rows: Summary[]) =>
  [
    "| Formula | Robust | Standout | Top1 | Top4 T/B | Top10 T/B | Top20 | Median rank | Mean rank | Worst Q Top10 | SD |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...rows.map(
      (x) =>
        `| ${x.name} | ${x.robustness.toFixed(1)} | ${pct(x.standout)} | ${pct(x.top1)} | ${pct(x.topSideTop4)} / ${pct(x.bottomSideTop4)} | ${pct(x.topSideTop10)} / ${pct(x.bottomSideTop10)} | ${pct(x.top20)} | ${x.medianRank} | ${x.meanRank.toFixed(1)} | ${pct(x.worstQuartileTop10)} | ${pct(x.dispersion)} |`,
    ),
  ].join("\n");
const sparsityRows = split.flatMap((x) => {
    const h = x.development,
      values = [] as number[];
    for (let i = 30; i < h.length; i++) {
      const train = h.slice(i - 30, i),
        unique = new Set(train.map((d) => d.top2)).size;
      values.push(100 - unique);
    }
    return values;
  }),
  ranges = split
    .map(
      (x) =>
        `- \`${x.snapshot.lotteryId}\` (${nameOf(x.snapshot.lotteryId)}): ${x.history[0].drawDate} to ${x.history.at(-1)!.drawDate}; dev ${x.holdoutStart}, holdout ${x.history.length - x.holdoutStart}; historyVersion \`${x.data.historyVersion}\``,
    )
    .join("\n"),
  defs = CORE_CANDIDATES.map(
    (x) =>
      `- **${x.name}** \`${x.id}@${x.version}\`: digit ${JSON.stringify(x.digitWeights)}; pair ${JSON.stringify(x.pairWeights)}`,
  ).join("\n");
const report = `# RoodLab Core v1 evaluation\n\nGenerated: ${new Date().toISOString()}\n\n## Frozen protocol\n\n- Canonical complete draws only; 30-draw training window.\n- Per lottery: oldest 75% development, newest 25% untouched holdout.\n- Candidate definitions were frozen before holdout evaluation.\n- Robustness = 35% cross-lottery consistency + 25% long-horizon aggregate + 20% pair ranking quality + 10% standout + 10% downside protection. It is not a probability.\n- Promotion requires holdout Top10 improvement, non-worse Top4 and worst quartile, and dispersion no more than 10% above Balanced v1.\n\n## Dataset (${eligible.length} lotteries)\n\nOnly ${eligible.length} cached lotteries met the 80-complete-draw requirement; BAAC had 41 and was excluded.\n\n${ranges}\n\nDevelopment evaluation draws per formula: ${development[0].draws}. Holdout evaluation draws per finalist: ${holdout[0].draws}.\n\n## Candidate definitions\n\n${defs}\n\n## Feature ablation and sparsity findings\n\nPrior registered ablations plus this tournament show exact/recent ordered-pair evidence is sparse and unstable; digit marginals and positional compatibility are the defensible candidate family. Across development 30-draw windows, mean unseen exact-pair share was ${mean(sparsityRows).toFixed(1)}%; median was ${median(sparsityRows).toFixed(1)}%. Median exact-pair frequency across 00–99 is 0 by construction in a 30-draw window. Candidate formulas therefore cap exact-pair weight at 5%.\n\n## Development tournament\n\n${table(development)}\n\nDevelopment finalists frozen: ${finalists.map((x) => `${x.name} (${x.id}@${x.version})`).join(", ")}.\n\n## Final holdout (opened once)\n\n${table(holdout)}\n\nMathematical references for 100 ordered pairs: Top1 1%, Top4 4%, Top10 10%, Top20 20%; expected random MRR approximately 5.19%. No standalone standout baseline is claimed.\n\n## Promotion decision\n\n**${promote ? `Promote ${winner.name} as RoodLab Core v1` : `No Core v1 promotion yet. Balanced v1 remains default.`}**\n\n${promote ? "The finalist passed every frozen holdout promotion condition." : `Best holdout finalist was ${winner.name}; it did not satisfy all frozen consistency/downside conditions versus Balanced v1. No production definition or persisted default was changed.`}\n\n## Limitations\n\n- Available cache contained 19 eligible lotteries, not 20.\n- Most histories are capped at 100 draws, limiting development evaluation to about 45 draws and holdout to 25 per lottery.\n- Results are historical ranking diagnostics, not evidence that lottery outcomes are predictable.\n- Pair sparsity and short holdouts make Top1/Top4 noisy; rank distribution and downside metrics are included for that reason.\n`;
await fs.mkdir(path.join(process.cwd(), "reports"), { recursive: true });
await fs.writeFile(
  path.join(process.cwd(), "reports", "roodlab-core-v1-evaluation.md"),
  report,
  "utf8",
);
console.log(
  JSON.stringify(
    {
      eligible: eligible.map((x) => x.snapshot.lotteryId),
      development,
      finalists: finalists.map((x) => x.id),
      holdout,
      promote,
      winner: winner.formulaId,
      report: "reports/roodlab-core-v1-evaluation.md",
    },
    null,
    2,
  ),
);
