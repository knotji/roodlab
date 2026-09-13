import { promises as fs } from "node:fs";
import path from "node:path";
import { buildDailyGlobalComparison, targetOutcomePopulation } from "../src/lib/analysis/daily-global-targets";
import { drawWeekday } from "../src/lib/analysis/day-pattern";
import type { PlayedUniverseWeekday } from "../src/lib/analysis/played-universe";
import type { Snapshot } from "../src/lib/cache";
import type { LotteryDefinition } from "../src/lib/types";

const root = process.cwd(), catalog = JSON.parse(await fs.readFile(path.join(root, "data/lotteries.json"), "utf8")) as LotteryDefinition[],
  files = (await fs.readdir(path.join(root, "data/history"))).filter((name) => name.endsWith(".json")), snapshots: Record<string, Snapshot> = {};
for (const file of files) { const value = JSON.parse(await fs.readFile(path.join(root, "data/history", file), "utf8")) as Snapshot; snapshots[value.lotteryId] = value; }

const dates = [...new Set(Object.values(snapshots).flatMap((snapshot) => snapshot.draws.map((draw) => draw.drawDate)))].filter((date) => date <= "2026-09-11").sort(),
  combinations: string[][] = [];
function choose(start: number, picked: string[]) { if (picked.length === 6) { combinations.push(picked); return; } for (let digit = start; digit <= 10 - (6 - picked.length); digit++) choose(digit + 1, [...picked, String(digit)]); }
choose(0, []);
const hit = (pair: string, digits: string[]) => digits.includes(pair[0]) && digits.includes(pair[1]),
  exactBaseline = (top2: string, bottom2: string) => ({
    top: combinations.filter((digits) => hit(top2, digits)).length / combinations.length,
    bottom: combinations.filter((digits) => hit(bottom2, digits)).length / combinations.length,
    either: combinations.filter((digits) => hit(top2, digits) || hit(bottom2, digits)).length / combinations.length,
    both: combinations.filter((digits) => hit(top2, digits) && hit(bottom2, digits)).length / combinations.length,
  });
type Row = { date: string; n: number; missing: number; aTop: number; aBottom: number; aEither: number; aBoth: number; bTop: number; bBottom: number; bEither: number; bBoth: number; randomTop: number; randomBottom: number; randomEither: number; randomBoth: number };
const mean = (values: number[]) => values.reduce((a,b)=>a+b,0)/values.length;
const rows: Row[] = [];
for (const date of dates) {
  const weekday = drawWeekday(date) as PlayedUniverseWeekday;
  const comparison = buildDailyGlobalComparison({ catalog, snapshots, targetDate: date, weekday, historical: true }), population = targetOutcomePopulation(comparison, snapshots);
  if (!population.available.length || !comparison.modes.locked.result.sufficient || !comparison.modes.today_eligible.result.sufficient) continue;
  const a = comparison.modes.locked.result.digits.map((item) => item.digit), b = comparison.modes.today_eligible.result.digits.map((item) => item.digit), n = population.available.length;
  const score = (digits: string[], side: "top2" | "bottom2") => population.available.filter((outcome) => hit(outcome[side], digits)).length / n;
  const either = (digits: string[]) => population.available.filter((outcome) => hit(outcome.top2, digits) || hit(outcome.bottom2, digits)).length / n,
    both = (digits: string[]) => population.available.filter((outcome) => hit(outcome.top2, digits) && hit(outcome.bottom2, digits)).length / n;
  const random = population.available.map((o) => exactBaseline(o.top2,o.bottom2));
  rows.push({ date, n, missing: population.scheduled - n, aTop: score(a,"top2"), aBottom: score(a,"bottom2"), aEither: either(a), aBoth: both(a), bTop: score(b,"top2"), bBottom: score(b,"bottom2"), bEither: either(b), bBoth: both(b), randomTop:mean(random.map(x=>x.top)),randomBottom:mean(random.map(x=>x.bottom)),randomEither:mean(random.map(x=>x.either)),randomBoth:mean(random.map(x=>x.both)) });
}
const bootstrapCi = (values:number[]) => { let seed=20260912; const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296), samples=Array.from({length:5000},()=>mean(Array.from({length:values.length},()=>values[Math.floor(rand()*values.length)]))).sort((a,b)=>a-b); return [samples[124],samples[4874]]; },
  metrics = ["Top","Bottom","Either","Both"] as const,
  summary = Object.fromEntries(metrics.map((metric) => { const key = metric as "Top"|"Bottom"|"Either"|"Both", av=rows.map(r=>r[`a${key}`]),bv=rows.map(r=>r[`b${key}`]),diff=bv.map((v,i)=>v-av[i]),random=rows.map(r=>r[`random${key}`]); return [metric.toLowerCase(),{a:mean(av),b:mean(bv),exactRandom:mean(random),aUplift:mean(av)-mean(random),bUplift:mean(bv)-mean(random),pairedDifference:mean(diff),pairedDifference95:bootstrapCi(diff)}]; }));
console.log(JSON.stringify({ protocol:{formula:"unchanged production ranking",winSize:6,lookback:"unchanged max 12 same-weekday",primaryMetric:"mean daily full-hit proportion",targetPopulation:"same explicit Bangkok-day schedules for A and B",a:"locked production sources",b:"scheduled-today eligible sources",endDate:"2026-09-11",historicalStatus:"retrospective simulation; historical schedule metadata is not time-versioned",afterMidnight:"excluded from retrospective scoring until provider date boundary is verified"}, days:rows.length, outcomes:rows.reduce((s,r)=>s+r.n,0), missing:rows.reduce((s,r)=>s+r.missing,0), dailyMean:summary },null,2));
