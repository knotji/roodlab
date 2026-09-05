import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import nextEnv from "@next/env";
import {
  currentBangkokDateKey,
  drawWeekday,
} from "../src/lib/analysis/day-pattern";
import { resolveGlobalDailySources } from "../src/lib/analysis/global-daily-eligibility";
import {
  buildFrequencyTop21,
  buildJoint21,
  classifyJoint21,
} from "../src/lib/analysis/global-joint-21";
import { GLOBAL_WEEKDAY_LOOKBACK } from "../src/lib/analysis/global-weekday-win";
import {
  readAllSnapshots,
  readCatalog,
  readCatalogAudit,
} from "../src/lib/cache";
import { isCompleteDraw } from "../src/lib/data-sources/integrity";
const FREEZE_DATE = "2026-09-05",
  HEAD = "25d75de",
  MIN_TARGETS = 10,
  BOOTSTRAPS = 10000,
  SEED = 20260905,
  BASE = `global-joint-21-${FREEZE_DATE}`;
const protocol = {
  freezeDate: FREEZE_DATE,
  baseline: `main@${HEAD}`,
  strategy: "deterministic greedy Joint 21",
  candidates: "55 canonical reverse-pairs including doubles",
  objectives: [
    "weighted both-hit coverage",
    "min top/bottom coverage",
    "source breadth",
    "total coverage",
    "lexical numeric tie",
  ],
  data: {
    canonicalEligibility: true,
    completeOnly: true,
    sameWeekday: true,
    maxPriorPerLottery: GLOBAL_WEEKDAY_LOOKBACK,
    equalSourceWeighting: true,
    targetExcluded: true,
  },
  comparison: "Frequency Top 21",
  split: "oldest 75% development / newest 25% holdout",
  bootstrap: { iterations: BOOTSTRAPS, cluster: "target date", seed: SEED },
  prohibitions: [
    "no tuning",
    "no production change",
    "no Gemini selection",
    "no prospective tracking",
  ],
};
const protocolHash = createHash("sha256")
    .update(JSON.stringify(protocol))
    .digest("hex")
    .slice(0, 16),
  zero = () => ({
    both: 0,
    top: 0,
    bottom: 0,
    topOnly: 0,
    bottomOnly: 0,
    miss: 0,
  });
type Counts = ReturnType<typeof zero>;
type Row = {
  date: string;
  outcomes: number;
  joint: Counts;
  frequency: Counts;
  jointRandom: number;
  frequencyRandom: number;
  contributors: number;
  jointExpanded: number;
  frequencyExpanded: number;
};
const add = (x: Counts, c: string) => {
  if (c === "both") {
    x.both++;
    x.top++;
    x.bottom++;
  } else if (c === "topOnly") {
    x.top++;
    x.topOnly++;
  } else if (c === "bottomOnly") {
    x.bottom++;
    x.bottomOnly++;
  } else x.miss++;
};
function aggregate(rows: Row[]) {
  const n = rows.reduce((s, r) => s + r.outcomes, 0),
    sum = (which: "joint" | "frequency", k: keyof Counts) =>
      rows.reduce((s, r) => s + r[which][k], 0),
    metric = (which: "joint" | "frequency", k: keyof Counts) =>
      n ? sum(which, k) / n : 0,
    random = (which: "jointRandom" | "frequencyRandom") =>
      n ? rows.reduce((s, r) => s + r[which] * r.outcomes, 0) / n : 0;
  return {
    dates: rows.length,
    outcomes: n,
    joint: {
      both: metric("joint", "both"),
      top: metric("joint", "top"),
      bottom: metric("joint", "bottom"),
      topOnly: metric("joint", "topOnly"),
      bottomOnly: metric("joint", "bottomOnly"),
      miss: metric("joint", "miss"),
      randomBoth: random("jointRandom"),
    },
    frequency: {
      both: metric("frequency", "both"),
      top: metric("frequency", "top"),
      bottom: metric("frequency", "bottom"),
      topOnly: metric("frequency", "topOnly"),
      bottomOnly: metric("frequency", "bottomOnly"),
      miss: metric("frequency", "miss"),
      randomBoth: random("frequencyRandom"),
    },
    pairedBothDifference: n
      ? (sum("joint", "both") - sum("frequency", "both")) / n
      : 0,
  };
}
const seeded = (seed: number) => {
    let s = seed >>> 0;
    return () => (s = (1664525 * s + 1013904223) >>> 0) / 4294967296;
  },
  percentile = (v: number[], p: number) => {
    const x = [...v].sort((a, b) => a - b),
      i = (x.length - 1) * p,
      l = Math.floor(i),
      h = Math.ceil(i);
    return x[l] * (h - i) + x[h] * (i - l);
  };
function bootstrap(rows: Row[], seed: number) {
  const rng = seeded(seed),
    values: number[] = [];
  for (let i = 0; i < BOOTSTRAPS; i++) {
    const sample = Array.from(
      { length: rows.length },
      () => rows[Math.floor(rng() * rows.length)],
    );
    values.push(aggregate(sample).pairedBothDifference);
  }
  return [percentile(values, 0.025), percentile(values, 0.975)];
}
nextEnv.loadEnvConfig(process.cwd());
const [catalog, snapshots, audit] = await Promise.all([
    readCatalog(),
    readAllSnapshots(),
    readCatalogAudit(),
  ]),
  dates = [
    ...new Set(
      Object.values(snapshots).flatMap((s) =>
        s.draws.filter(isCompleteDraw).map((d) => d.drawDate),
      ),
    ),
  ]
    .filter((d) => d <= FREEZE_DATE)
    .sort(),
  rows: Row[] = [];
for (const date of dates) {
  const weekday = drawWeekday(date) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    resolved = resolveGlobalDailySources({
      catalog,
      snapshots,
      audit,
      targetDate: date,
      weekday,
      historical: true,
    }),
    ids = new Set(resolved.sources.map((s) => s.lotteryId)),
    targets = Object.values(snapshots)
      .filter((s) => ids.has(s.lotteryId))
      .flatMap((s) =>
        s.draws.filter(
          (d) =>
            d.drawDate === date && isCompleteDraw(d) && d.top2 && d.bottom2,
        ),
      );
  if (resolved.sources.length < 10 || targets.length < MIN_TARGETS) continue;
  const joint = buildJoint21(resolved.sources, { weekday, cutoffDate: date }),
    frequency = buildFrequencyTop21(resolved.sources, {
      weekday,
      cutoffDate: date,
    }),
    row: Row = {
      date,
      outcomes: targets.length,
      joint: zero(),
      frequency: zero(),
      jointRandom: (joint.expandedActualCount / 100) ** 2,
      frequencyRandom: (frequency.expandedActualCount / 100) ** 2,
      contributors: resolved.sources.length,
      jointExpanded: joint.expandedActualCount,
      frequencyExpanded: frequency.expandedActualCount,
    };
  for (const target of targets) {
    add(
      row.joint,
      classifyJoint21(new Set(joint.selectedPairs), {
        topPair: target.top2!,
        bottomPair: target.bottom2!,
      }),
    );
    add(
      row.frequency,
      classifyJoint21(new Set(frequency.selectedPairs), {
        topPair: target.top2!,
        bottomPair: target.bottom2!,
      }),
    );
  }
  rows.push(row);
}
if (rows.length < 8) throw new Error(`Insufficient rows: ${rows.length}`);
const split = Math.floor(rows.length * 0.75),
  developmentRows = rows.slice(0, split),
  holdoutRows = rows.slice(split),
  sections = {
    development: aggregate(developmentRows),
    holdout: aggregate(holdoutRows),
    all: aggregate(rows),
  },
  confidence = {
    development: bootstrap(developmentRows, SEED + 1),
    holdout: bootstrap(holdoutRows, SEED + 2),
    all: bootstrap(rows, SEED),
  },
  currentDate = currentBangkokDateKey(),
  currentWeekday = drawWeekday(currentDate) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
  currentResolved = resolveGlobalDailySources({
    catalog,
    snapshots,
    audit,
    targetDate: currentDate,
    weekday: currentWeekday,
  }),
  sample = buildJoint21(currentResolved.sources, {
    weekday: currentWeekday,
    cutoffDate: currentDate,
  }),
  historyHash = createHash("sha256")
    .update(
      Object.values(snapshots)
        .map((s) => `${s.lotteryId}:${s.historyVersion}`)
        .sort()
        .join("|"),
    )
    .digest("hex")
    .slice(0, 16),
  holdout = sections.holdout,
  ci = confidence.holdout,
  decision =
    holdout.pairedBothDifference > 0 &&
    ci[0] > 0 &&
    sections.development.pairedBothDifference > 0
      ? "SUPPORT"
      : holdout.pairedBothDifference <= 0 ||
          sections.development.pairedBothDifference <= 0
        ? "REJECT"
        : "INCONCLUSIVE",
  result = {
    protocol,
    protocolHash,
    historyHash,
    data: {
      catalog: catalog.length,
      snapshots: Object.keys(snapshots).length,
      range: [rows[0].date, rows.at(-1)!.date],
      targetDates: rows.length,
      outcomes: sections.all.outcomes,
    },
    sample,
    sections,
    confidence,
    monthly: Object.entries(
      Object.groupBy(rows, (r) => r.date.slice(0, 7)),
    ).map(([month, r]) => ({ month, ...aggregate(r ?? []) })),
    weekday: Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      ...aggregate(rows.filter((r) => drawWeekday(r.date) === weekday)),
    })),
    decision,
  };
const pct = (v: number) => `${(v * 100).toFixed(2)}%`,
  pp = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(2)}pp`,
  table = (key: "development" | "holdout" | "all") => {
    const s = sections[key],
      c = confidence[key];
    return `| ${key} | ${s.dates} | ${s.outcomes} | ${pct(s.joint.both)} | ${pct(s.frequency.both)} | ${pp(s.pairedBothDifference)} | ${pp(c[0])} to ${pp(c[1])} | ${pct(s.joint.randomBoth)} | ${pp(s.joint.both - s.joint.randomBoth)} |`;
  },
  detail = (key: "development" | "holdout" | "all") => {
    const s = sections[key];
    return `| ${key} | ${pct(s.joint.top)} | ${pct(s.joint.bottom)} | ${pct(s.joint.topOnly)} | ${pct(s.joint.bottomOnly)} | ${pct(s.joint.miss)} |`;
  },
  report = `# Global Joint 21 frozen study\n\nFreeze date: ${FREEZE_DATE}  \nBaseline: \`main@${HEAD}\`  \nProtocol: \`${protocolHash}\`  \nHistory: \`${historyHash}\`\n\n## Frozen protocol\n\nDeterministic greedy maximum joint-coverage over exactly 21 canonical reverse-pairs. Every lottery is normalized internally before equal-source aggregation; same weekday, maximum 12 strictly prior observations, complete top/bottom events only. No target or future result enters selection. Frequency Top 21 is the single comparator. Random both-side reference uses the actual reverse-expanded count K: \`(K/100)^2\`. It is an independence reference, not a model of lottery dependence.\n\n## Sample set\n\n- Pairs: ${sample.selectedPairs.join(" ")}\n- Doubles: ${sample.selectedDoubles.join(" ") || "none"}\n- Expanded actual numbers: ${sample.expandedActualCount}\n- Historical both-side coverage: ${pct(sample.bothHitRate)}; top ${pct(sample.topHitRate)}; bottom ${pct(sample.bottomHitRate)}\n- Historical source coverage: ${pct(sample.sourceCoverage)}\n\n## Walk-forward results\n\n| Section | Dates | Outcomes | Joint both | Frequency both | Paired diff | Paired 95% CI | Random reference | Joint vs random |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|\n${table("development")}\n${table("holdout")}\n${table("all")}\n\n### Joint 21 outcome classification\n\n| Section | Top coverage | Bottom coverage | Top only | Bottom only | Miss |\n|---|---:|---:|---:|---:|---:|\n${detail("development")}\n${detail("holdout")}\n${detail("all")}\n\n## Decision\n\n**${decision}**. ${decision === "SUPPORT" ? "Research-supported candidate only; no production promotion is authorized." : "Joint 21 does not provide stable holdout evidence sufficient to alter production."}\n\n## Contract confirmation\n\n- Production Global Win changed: **NO**\n- Production weights or eligibility changed: **NO**\n- Gemini contract changed: **NO**\n- Prospective tracking added: **NO**\n- Predictive/probability claim: **NO**\n`;
await fs.mkdir(path.join(process.cwd(), "reports"), { recursive: true });
await fs.writeFile(
  path.join("reports", `${BASE}.json`),
  `${JSON.stringify(result, null, 2)}\n`,
);
await fs.writeFile(path.join("reports", `${BASE}.md`), report);
console.log(
  JSON.stringify(
    {
      report: `reports/${BASE}.md`,
      protocolHash,
      historyHash,
      data: result.data,
      sample,
      sections,
      confidence,
      decision,
    },
    null,
    2,
  ),
);
