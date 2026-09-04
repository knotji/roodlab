import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import nextEnv from "@next/env";
import { GLOBAL_DAILY_SOURCE_IDS } from "../src/lib/analysis/global-daily-sources";
import { drawWeekday } from "../src/lib/analysis/day-pattern";
import { buildGlobalRankConsensus, classifyRankConsensusPair, evaluateRankConsensusOutcome, type RankBallot } from "../src/lib/analysis/global-rank-consensus-study";
import { exactRandomBothCoverage, exactRandomPairCoverage } from "../src/lib/analysis/global-weekday-evaluation";
import { buildGlobalWeekdayWin, GLOBAL_WEEKDAY_LOOKBACK } from "../src/lib/analysis/global-weekday-win";
import { computeHistoryVersion, readAllSnapshots, readCatalog } from "../src/lib/cache";
import { AllHuayDataSource } from "../src/lib/data-sources/allhuay";
import type { LotteryDraw } from "../src/lib/types";

const FREEZE_DATE = "2026-09-04", HEAD = "ae43052", WIN_SIZE = 6, MIN_TARGET_LOTTERIES = 10, BOOTSTRAPS = 10_000, SEED = 20260904,
  REPORT_BASE = "global-rank-consensus-study-2026-09-04", POOL = [...GLOBAL_DAILY_SOURCE_IDS];

const protocol = {
  freezeDate: FREEZE_DATE,
  codeBaseline: `main@${HEAD}`,
  universe: { source: "src/lib/analysis/global-daily-sources.ts#GLOBAL_DAILY_SOURCE_IDS", size: POOL.length, ids: POOL },
  commonData: { sameWeekdayOnly: true, maximumPriorObservationsPerLottery: GLOBAL_WEEKDAY_LOOKBACK, targetAndFutureExcluded: true, presencePerDraw: true, duplicateDigitCountedOncePerSide: true, noImputation: true },
  strategyA: "exact production buildGlobalWeekdayWin overall Top 6",
  strategyB: { name: "Global Rank Consensus", localSignal: "same per-lottery normalized top/bottom presence rates as production", rankPoints: [10,9,8,7,6,5,4,3,2,1], oneBallotPerEligibleLottery: true, aggregation: "mean rank points", winSize: WIN_SIZE },
  ties: { withinLottery: "score descending, topRate+bottomRate descending, digit ascending via rankGlobalDigitScores", globalConsensus: "mean rank points descending, digit ascending via rankGlobalDigitScores with neutral side fields" },
  targets: { completeTop2AndBottom2Required: true, sameTargetsForBothStrategies: true, minimumLotteriesPerDate: MIN_TARGET_LOTTERIES },
  primaryMetric: "full two-digit hit on either top2 or bottom2",
  secondaryMetrics: ["full top2 hit", "full bottom2 hit", "either-side full hit", "both-sides full hit", "digit recall"],
  randomBaseline: "exact enumeration of all 6-of-10 sets with double-aware pair coverage",
  split: { development: "oldest 75% eligible target dates", holdout: "newest 25% eligible target dates" },
  bootstrap: { iterations: BOOTSTRAPS, cluster: "target date", seed: SEED },
  prohibition: "One comparison only; no tuning, production, UI, pool, persistence, or prospective change.",
} as const;

if (POOL.length !== 46 || new Set(POOL).size !== POOL.length) throw new Error(`Resolved production pool mismatch: ${POOL.length}/46`);
const protocolHash = createHash("sha256").update(JSON.stringify(protocol)).digest("hex").slice(0, 16);

type Source = { lotteryId: string; historyVersion: string; draws: LotteryDraw[] };
type MetricKey = "top" | "bottom" | "either" | "both" | "recall";
type Totals = Record<MetricKey, number>;
type Decomposition = Record<"both" | "productionOnly" | "consensusOnly" | "neither", number>;
type DateRow = { date: string; outcomes: number; voters: number; production: Totals; consensus: Totals; expected: Totals; decomposition: Decomposition; shared: number; jaccard: number; ballots: RankBallot[] };

const zero = (): Totals => ({ top: 0, bottom: 0, either: 0, both: 0, recall: 0 });
const zeroDecomposition = (): Decomposition => ({ both: 0, productionOnly: 0, consensusOnly: 0, neither: 0 });
function add(total: Totals, value: { top: boolean; bottom: boolean; either: boolean; both: boolean; recall: number }) { total.top += Number(value.top); total.bottom += Number(value.bottom); total.either += Number(value.either); total.both += Number(value.both); total.recall += value.recall; }
function baseline(top2: string, bottom2: string): Totals { const top = exactRandomPairCoverage(top2, 6), bottom = exactRandomPairCoverage(bottom2, 6), both = exactRandomBothCoverage(top2, bottom2, 6); return { top, bottom, either: top + bottom - both, both, recall: 0.6 }; }
function mean(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function median(values: number[]) { if (!values.length) return 0; const sorted = [...values].sort((a,b)=>a-b), middle = Math.floor(sorted.length/2); return sorted.length % 2 ? sorted[middle] : (sorted[middle-1]+sorted[middle])/2; }

function aggregate(rows: readonly DateRow[]) {
  const outcomes = rows.reduce((sum,row)=>sum+row.outcomes,0), sum = (field: "production"|"consensus"|"expected", key: MetricKey) => rows.reduce((total,row)=>total+row[field][key],0),
    metrics = (field: "production"|"consensus") => Object.fromEntries((Object.keys(zero()) as MetricKey[]).map((key)=>{ const rate=outcomes?sum(field,key)/outcomes:0, random=outcomes?sum("expected",key)/outcomes:0; return [key,{rate,baseline:random,uplift:rate-random}]; })) as Record<MetricKey,{rate:number;baseline:number;uplift:number}>,
    decomposition = Object.fromEntries((Object.keys(zeroDecomposition()) as (keyof Decomposition)[]).map((key)=>[key,rows.reduce((total,row)=>total+row.decomposition[key],0)])) as Decomposition,
    shared = rows.map((row)=>row.shared);
  return { dates: rows.length, outcomes, production: metrics("production"), consensus: metrics("consensus"), pairedDifference: outcomes ? (sum("consensus","either")-sum("production","either"))/outcomes : 0, decomposition,
    similarity: { meanShared: mean(shared), medianShared: median(shared), meanChanged: mean(shared.map((value)=>6-value)), meanJaccard: mean(rows.map((row)=>row.jaccard)), distribution: Object.fromEntries(Array.from({length:7},(_,value)=>[String(value),shared.filter((item)=>item===value).length])) } };
}
function seeded(seed:number){let state=seed>>>0;return()=>((state=(1664525*state+1013904223)>>>0)/4294967296);}
function percentile(values:number[],p:number){const sorted=[...values].sort((a,b)=>a-b),index=(sorted.length-1)*p,lo=Math.floor(index),hi=Math.ceil(index),w=index-lo;return sorted[lo]*(1-w)+sorted[hi]*w;}
function bootstrap(rows: readonly DateRow[], seed:number){ const random=seeded(seed),production:number[]=[],consensus:number[]=[],paired:number[]=[]; for(let i=0;i<BOOTSTRAPS;i+=1){const sample=Array.from({length:rows.length},()=>rows[Math.floor(random()*rows.length)]),value=aggregate(sample);production.push(value.production.either.uplift);consensus.push(value.consensus.either.uplift);paired.push(value.pairedDifference);} const ci=(v:number[])=>[percentile(v,.025),percentile(v,.975)];return{productionUplift95:ci(production),consensusUplift95:ci(consensus),pairedDifference95:ci(paired)};}

nextEnv.loadEnvConfig(process.cwd());
const snapshots=await readAllSnapshots(), poolSet=new Set<string>(POOL), stored=Object.values(snapshots).filter((source)=>poolSet.has(source.lotteryId)) as Source[], missing=POOL.filter((id)=>!stored.some((source)=>source.lotteryId===id)), catalog=await readCatalog(), provider=new AllHuayDataSource(catalog),
  hydrated=await Promise.all(missing.map(async(lotteryId):Promise<Source>=>{const result=await provider.getCanonicalHistory(lotteryId,{limit:100});if(!result.draws.length)throw new Error(`No historical draws returned for ${lotteryId}`);return{lotteryId,draws:result.draws,historyVersion:computeHistoryVersion(lotteryId,result.draws)};})),
  byId=new Map([...stored,...hydrated].map((source)=>[source.lotteryId,source])), sources=POOL.map((id)=>byId.get(id)).filter((source):source is Source=>Boolean(source));
if(sources.length!==POOL.length)throw new Error(`Exact current production pool unavailable: ${sources.length}/${POOL.length}`);
const historyHash=createHash("sha256").update(sources.map((source)=>`${source.lotteryId}:${source.historyVersion}`).sort().join("|")).digest("hex").slice(0,16), dates=[...new Set(sources.flatMap((source)=>source.draws.map((draw)=>draw.drawDate)))].filter((date)=>date<=FREEZE_DATE).sort(), rows:DateRow[]=[];

for(const date of dates){
  const weekday=drawWeekday(date) as 0|1|2|3|4|5|6, production=buildGlobalWeekdayWin(sources,{weekday,cutoffDate:date}), consensus=buildGlobalRankConsensus(sources,{weekday,cutoffDate:date}), targets=sources.flatMap((source)=>source.draws.filter((draw)=>draw.drawDate===date&&draw.top2&&draw.bottom2));
  if(!production.sufficient||targets.length<MIN_TARGET_LOTTERIES)continue;
  if(consensus.ballots.length!==production.lotteryCount)throw new Error(`Eligibility mismatch on ${date}: ${consensus.ballots.length}/${production.lotteryCount}`);
  const productionDigits=production.rankedDigits.slice(0,6).map((item)=>item.digit), productionSet=new Set(productionDigits), consensusSet=new Set(consensus.digits), shared=[...productionSet].filter((digit)=>consensusSet.has(digit)).length,
    row:DateRow={date,outcomes:targets.length,voters:consensus.ballots.length,production:zero(),consensus:zero(),expected:zero(),decomposition:zeroDecomposition(),shared,jaccard:shared/(12-shared),ballots:consensus.ballots};
  for(const target of targets){const a=evaluateRankConsensusOutcome(productionDigits,target.top2!,target.bottom2!),b=evaluateRankConsensusOutcome(consensus.digits,target.top2!,target.bottom2!),expected=baseline(target.top2!,target.bottom2!);add(row.production,a);add(row.consensus,b);(Object.keys(expected) as MetricKey[]).forEach((key)=>row.expected[key]+=expected[key]);row.decomposition[classifyRankConsensusPair(a,b)]+=1;}
  rows.push(row);
}
if(rows.length<8)throw new Error(`Insufficient walk-forward dates: ${rows.length}`);

const splitIndex=Math.floor(rows.length*.75), developmentRows=rows.slice(0,splitIndex), holdoutRows=rows.slice(splitIndex), sections={development:aggregate(developmentRows),holdout:aggregate(holdoutRows),all:aggregate(rows)}, confidence={development:bootstrap(developmentRows,SEED+1),holdout:bootstrap(holdoutRows,SEED+2),all:bootstrap(rows,SEED)},
  months=Object.entries(Object.groupBy(rows,(row)=>row.date.slice(0,7))).map(([month,values])=>({month,...aggregate(values??[])})),
  diagnosticRanks=Object.fromEntries(Array.from({length:10},(_,value)=>String(value)).map((digit)=>{const ranks=rows.flatMap((row)=>row.ballots.map((ballot)=>ballot.ranking.findIndex((item)=>item.digit===digit)+1));return[digit,{ballots:ranks.length,meanRank:mean(ranks),medianRank:median(ranks),top1Count:ranks.filter((rank)=>rank===1).length,top1Share:ranks.filter((rank)=>rank===1).length/ranks.length,top3Count:ranks.filter((rank)=>rank<=3).length,top3Share:ranks.filter((rank)=>rank<=3).length/ranks.length,top6Count:ranks.filter((rank)=>rank<=6).length,top6Share:ranks.filter((rank)=>rank<=6).length/ranks.length}];})),
  poolDetails=POOL.map((id)=>({id,name:catalog.find((item)=>item.id===id)?.name??id})), result={protocol,protocolHash,historyHash,pool:poolDetails,data:{range:[rows[0].date,rows.at(-1)!.date],storedSources:stored.length,readOnlyHydratedSources:hydrated.map((source)=>source.lotteryId),targetDates:rows.length,outcomes:sections.all.outcomes},sections,confidence,months,consensusDiagnostics:diagnosticRanks};

const pct=(v:number)=>`${(v*100).toFixed(2)}%`,pp=(v:number)=>`${v>=0?"+":""}${(v*100).toFixed(2)}pp`,ci=(v:number[])=>`${pp(v[0])} to ${pp(v[1])}`,
  sectionRows=(["development","holdout","all"] as const).map((key)=>{const s=sections[key],c=confidence[key];return`| ${key} | ${s.dates} | ${s.outcomes} | ${pct(s.production.either.rate)} | ${pct(s.consensus.either.rate)} | ${pct(s.production.either.baseline)} | ${pp(s.production.either.uplift)} | ${ci(c.productionUplift95)} | ${pp(s.consensus.either.uplift)} | ${ci(c.consensusUplift95)} | ${pp(s.pairedDifference)} | ${ci(c.pairedDifference95)} |`;}).join("\n"),
  secondaryRows=(["top","bottom","either","both","recall"] as MetricKey[]).map((key)=>`| ${key} | ${pct(sections.all.production[key].rate)} | ${pct(sections.all.consensus[key].rate)} | ${pct(sections.all.production[key].baseline)} | ${pp(sections.all.production[key].uplift)} | ${pp(sections.all.consensus[key].uplift)} |`).join("\n"),
  monthRows=months.map((item)=>`| ${item.month} | ${item.dates} | ${item.outcomes} | ${pct(item.production.either.rate)} | ${pct(item.consensus.either.rate)} | ${pp(item.pairedDifference)} |`).join("\n"),
  diagnosticRows=Object.entries(diagnosticRanks).map(([digit,item])=>`| ${digit} | ${item.ballots} | ${item.meanRank.toFixed(2)} | ${item.medianRank.toFixed(1)} | ${item.top1Count} (${pct(item.top1Share)}) | ${item.top3Count} (${pct(item.top3Share)}) | ${item.top6Count} (${pct(item.top6Share)}) |`).join("\n"), all=sections.all, allCi=confidence.all,
  conclusion=all.pairedDifference<=0?"Global Rank Consensus did not improve the primary metric; retain the frozen production method.":allCi.pairedDifference95[0]<=0?"The pooled estimate favored Global Rank Consensus, but uncertainty includes no difference; retain the frozen production method.":sections.development.pairedDifference>0&&sections.holdout.pairedDifference>0?"Global Rank Consensus showed consistent positive retrospective evidence, but this study does not authorize a production change.":"Global Rank Consensus was inconsistent across Development and Holdout; retain the frozen production method.",
  report=`# Global Rank Consensus study\n\nFreeze date: ${FREEZE_DATE}  \nCode baseline: \`main@${HEAD}\`  \nProtocol fingerprint: \`${protocolHash}\`  \nHistory fingerprint: \`${historyHash}\`\n\n## Research question\n\nDoes aggregating per-lottery digit ranks using fixed 10-to-1 points perform differently from the current production aggregation of normalized historical frequency scores?\n\n## Production source of truth and pool\n\n- Source: \`src/lib/analysis/global-daily-sources.ts#GLOBAL_DAILY_SOURCE_IDS\`\n- Resolved active lotteries: **${POOL.length}**\n- Exact IDs: ${POOL.map((id)=>`\`${id}\``).join(", ")}\n\n## Frozen protocol\n\n- Strategy A calls the production \`buildGlobalWeekdayWin\` implementation and selects overall ranks 1-6.\n- Both strategies use the same eligible lotteries, same weekday, at most ${GLOBAL_WEEKDAY_LOOKBACK} prior same-weekday observations per lottery, per-draw digit presence, duplicate digits counted once per side, per-lottery normalization, and available top/bottom sides with equal weighting.\n- Strategy B ranks 0-9 within each eligible lottery, awards fixed points 10 through 1, gives every eligible lottery one equal ballot, averages points globally, and selects ranks 1-6.\n- Within-lottery ties: score descending, top+bottom rate descending, digit ascending. Global point ties: digit ascending. No random tie breaking.\n- Targets and future draws are excluded. Missing histories receive no ballot and are not imputed.\n- Primary metric: full two-digit hit on either top2 or bottom2. Exact random baseline enumerates all 6-of-10 sets and handles doubles exactly.\n- Chronological split: oldest 75% Development, newest 25% Holdout. Confidence intervals use ${BOOTSTRAPS.toLocaleString("en-US")} target-date clustered bootstrap iterations.\n- One comparison only; no tuning or production change is permitted.\n\n## Data\n\n- Range: ${result.data.range[0]} to ${result.data.range[1]}\n- Eligible target dates: ${result.data.targetDates}\n- Complete outcomes: ${result.data.outcomes}\n- Stored sources: ${result.data.storedSources}/${POOL.length}; read-only hydration: ${result.data.readOnlyHydratedSources.join(", ")||"none"}\n\n## Primary result\n\n| Section | Dates | Outcomes | Production | Rank Consensus | Exact random | Production uplift | Production uplift 95% CI | Consensus uplift | Consensus uplift 95% CI | Paired B-A | Paired 95% CI |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n${sectionRows}\n\n## Secondary metrics - all data\n\n| Metric | Production | Rank Consensus | Exact random | Production uplift | Consensus uplift |\n|---|---:|---:|---:|---:|---:|\n${secondaryRows}\n\n## Paired decomposition - all data\n\n- Both hit: **${all.decomposition.both}** (${pct(all.decomposition.both/all.outcomes)})\n- Production only: **${all.decomposition.productionOnly}** (${pct(all.decomposition.productionOnly/all.outcomes)})\n- Rank Consensus only: **${all.decomposition.consensusOnly}** (${pct(all.decomposition.consensusOnly/all.outcomes)})\n- Neither: **${all.decomposition.neither}** (${pct(all.decomposition.neither/all.outcomes)})\n\n## Win-set similarity\n\n- Mean shared digits: **${all.similarity.meanShared.toFixed(2)}/6**; median: **${all.similarity.medianShared.toFixed(1)}/6**\n- Mean changed digits: **${all.similarity.meanChanged.toFixed(2)}**\n- Mean Jaccard: **${all.similarity.meanJaccard.toFixed(4)}**\n- Shared-membership distribution: ${Object.entries(all.similarity.distribution).map(([shared,count])=>`${shared}/6=${count}`).join(", ")}\n\n## Consensus diagnostics\n\n| Digit | Ballots | Mean rank | Median rank | Top 1 | Top 3 | Top 6 |\n|---|---:|---:|---:|---:|---:|---:|\n${diagnosticRows}\n\nThese diagnostics explain rank aggregation only and are not used to alter Strategy B.\n\n## Monthly consistency\n\n| Month | Dates | Outcomes | Production | Rank Consensus | Paired B-A |\n|---|---:|---:|---:|---:|---:|\n${monthRows}\n\n## Conclusion\n\n**${conclusion}**\n\n## Limitations\n\n- Retrospective analysis does not establish future predictive advantage.\n- Related sources can be correlated.\n- Date-clustered intervals reflect date variation but do not remove all structural dependencies.\n- Rank points discard score magnitude by design.\n\n## Contract confirmation\n\n- Production formula changed: **NO**\n- Production pool changed: **NO**\n- Production UI changed: **NO**\n- Prospective tracking added: **NO**\n- Production promotion authorized: **NO**\n`;

async function freezeFile(file:string,content:string){try{const existing=await fs.readFile(file,"utf8");if(existing!==content)throw new Error(`Frozen report already exists with different content: ${file}`);}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;await fs.writeFile(file,content,"utf8");}}
const reportDir=path.join(process.cwd(),"reports");await fs.mkdir(reportDir,{recursive:true});await freezeFile(path.join(reportDir,`${REPORT_BASE}.json`),`${JSON.stringify(result,null,2)}\n`);await freezeFile(path.join(reportDir,`${REPORT_BASE}.md`),report);
console.log(JSON.stringify({report:`reports/${REPORT_BASE}.md`,protocolHash,historyHash,data:result.data,sections,confidence,months,similarity:all.similarity,decomposition:all.decomposition,conclusion},null,2));
