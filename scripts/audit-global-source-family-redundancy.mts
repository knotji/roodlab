import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import nextEnv from "@next/env";
import { GLOBAL_DAILY_SOURCE_IDS } from "../src/lib/analysis/global-daily-sources";
import { drawWeekday } from "../src/lib/analysis/day-pattern";
import { buildGlobalWeekdayWin } from "../src/lib/analysis/global-weekday-win";
import { classifyGlobalSource, compareOutcomeSources, compareTop6Membership, cosineSimilarity, pearsonCorrelation, topSetOverlap } from "../src/lib/analysis/global-source-redundancy";
import { computeHistoryVersion, readAllSnapshots, readCatalog } from "../src/lib/cache";
import { AllHuayDataSource } from "../src/lib/data-sources/allhuay";
import { liveResultSource } from "../src/lib/live-results";
import type { LotteryDraw } from "../src/lib/types";

const FREEZE_DATE = "2026-09-03", REPORT_BASE = "global-source-family-redundancy-2026-09-03", MIN_OVERLAP = 10, STRONGER_OVERLAP = 30, MIN_SIGNAL_HISTORY = 4, POOL = [...GLOBAL_DAILY_SOURCE_IDS];
if (POOL.length !== 39 || new Set(POOL).size !== 39) throw new Error(`Production pool mismatch: ${POOL.length}/39`);
nextEnv.loadEnvConfig(process.cwd());

type Source = { lotteryId: string; historyVersion: string; draws: LotteryDraw[] };
type Mapping = ReturnType<typeof classifyGlobalSource> & { lotteryId: string; displayName: string; catalogSourceUrl: string; liveProviderUrl: string | null };
type SignalPair = { left: string; right: string; familyRelation: "within" | "between"; dates: number; cosineMean: number; pearsonMean: number; top6OverlapMean: number };

const catalog = await readCatalog(), byCatalog = new Map(catalog.map((item) => [item.id, item])), mappings: Mapping[] = POOL.map((lotteryId) => {
  const item = byCatalog.get(lotteryId), classified = classifyGlobalSource(lotteryId), live = liveResultSource(lotteryId);
  if (!item) throw new Error(`Production source missing from catalog: ${lotteryId}`);
  return { ...classified, familyLabel: classified.ambiguous ? item.name : classified.familyLabel, lotteryId, displayName: item.name, catalogSourceUrl: item.sourceUrl, liveProviderUrl: live?.url ?? null };
}), familyById = new Map(mappings.map((item) => [item.lotteryId, item.familyId]));

const protocol = {
  freezeDate: FREEZE_DATE, codeBaseline: "main@f0b28b4", universe: { source: "GLOBAL_DAILY_SOURCE_IDS", size: 39, ids: POOL }, familyClassification: mappings,
  outcomeComparison: { completeResultsOnly: true, alignedDateOnly: true, minimumOverlap: MIN_OVERLAP, descriptiveRange: [MIN_OVERLAP, STRONGER_OVERLAP - 1], strongerInterpretationMinimum: STRONGER_OVERLAP, exactUniformNull: { top2: 0.01, bottom2: 0.01, eitherSide: 0.0199 }, overlapAndVectorNull: "descriptive only" },
  signalComparison: { targetAndFutureExcluded: true, sameWeekdayOnly: true, maximumHistory: 12, minimumHistoryPerLottery: MIN_SIGNAL_HISTORY, vector: "10 digit scores; presence per draw; top/bottom 50:50", metrics: ["cosine", "Pearson", "Top6 set overlap"] },
  familyFlagRule: "multiple entries and mean within-family signal cosine plus Top6 overlap both exceed between-family P75; diagnostic only",
  leaveOneFamilyOut: "Top6 membership sensitivity only; no outcome or hit-rate evaluation",
  prohibition: "No weighting, removal, pool selection, performance evaluation after removal, or production mutation",
} as const;
const protocolHash = createHash("sha256").update(JSON.stringify(protocol)).digest("hex").slice(0, 16);

const snapshots = await readAllSnapshots(), poolSet = new Set<string>(POOL), stored = Object.values(snapshots).filter((source) => poolSet.has(source.lotteryId)) as Source[], missing = POOL.filter((id) => !stored.some((source) => source.lotteryId === id)), dataSource = new AllHuayDataSource(catalog),
  hydrated = await Promise.all(missing.map(async (lotteryId): Promise<Source> => { const result = await dataSource.getCanonicalHistory(lotteryId, { limit: 100 }); if (!result.draws.length) throw new Error(`No history for ${lotteryId}`); return { lotteryId, historyVersion: computeHistoryVersion(lotteryId, result.draws), draws: result.draws }; })),
  bySource = new Map([...stored, ...hydrated].map((source) => [source.lotteryId, source])), sources = POOL.map((id) => bySource.get(id)).filter((source): source is Source => Boolean(source));
if (sources.length !== 39) throw new Error(`Exact production pool unavailable: ${sources.length}/39`);
const historyHash = createHash("sha256").update(sources.map((source) => `${source.lotteryId}:${source.historyVersion}`).sort().join("|")).digest("hex").slice(0, 16);

const outcomePairs = [] as Array<{ left: string; right: string; familyRelation: "within" | "between" } & ReturnType<typeof compareOutcomeSources>>;
for (let left = 0; left < sources.length; left += 1) for (let right = left + 1; right < sources.length; right += 1) {
  const a = sources[left], b = sources[right]; outcomePairs.push({ left: a.lotteryId, right: b.lotteryId, familyRelation: familyById.get(a.lotteryId) === familyById.get(b.lotteryId) ? "within" : "between", ...compareOutcomeSources(a.draws, b.draws) });
}

function sourceSignal(source: Source, date: string) {
  const draws = source.draws.filter((draw) => draw.drawDate < date && drawWeekday(draw.drawDate) === drawWeekday(date) && draw.top2 && draw.bottom2).sort((a, b) => b.drawDate.localeCompare(a.drawDate)).slice(0, 12);
  if (draws.length < MIN_SIGNAL_HISTORY) return null;
  return { history: draws.length, vector: Array.from({ length: 10 }, (_, digit) => { const value = String(digit), top = draws.filter((draw) => draw.top2!.includes(value)).length / draws.length, bottom = draws.filter((draw) => draw.bottom2!.includes(value)).length / draws.length; return (top + bottom) / 2; }) };
}

const allDates = [...new Set(sources.flatMap((source) => source.draws.map((draw) => draw.drawDate)))].filter((date) => date <= FREEZE_DATE).sort(), auditDates = allDates.filter((date) => {
  const completeTargets = sources.reduce((count, source) => count + Number(source.draws.some((draw) => draw.drawDate === date && draw.top2 && draw.bottom2)), 0), aggregate = buildGlobalWeekdayWin(sources, { weekday: drawWeekday(date) as 0|1|2|3|4|5|6, cutoffDate: date });
  return completeTargets >= 10 && aggregate.sufficient;
}), signalAccumulator = new Map<string, { left: string; right: string; relation: "within"|"between"; dates: number; cosine: number; pearson: number; overlap: number }>(),
  familyIds = [...new Set(mappings.map((item) => item.familyId))], familyEligibility = new Map(familyIds.map((id) => [id, { eligible: 0, history: 0 }])),
  sensitivity = new Map(familyIds.map((id) => [id, { dates: 0, overlap: 0, changed: 0, exactOrder: 0 }]));

for (const date of auditDates) {
  const signals = new Map(sources.map((source) => [source.lotteryId, sourceSignal(source, date)]).filter((entry): entry is [string, NonNullable<ReturnType<typeof sourceSignal>>] => Boolean(entry[1]))),
    normal = buildGlobalWeekdayWin(sources, { weekday: drawWeekday(date) as 0|1|2|3|4|5|6, cutoffDate: date }).rankedDigits.slice(0, 6).map((item) => item.digit);
  for (const mapping of mappings) { const signal = signals.get(mapping.lotteryId); if (signal) { const item = familyEligibility.get(mapping.familyId)!; item.eligible += 1; item.history += signal.history; } }
  for (let left = 0; left < sources.length; left += 1) for (let right = left + 1; right < sources.length; right += 1) {
    const a = signals.get(sources[left].lotteryId), b = signals.get(sources[right].lotteryId); if (!a || !b) continue;
    const leftId = sources[left].lotteryId, rightId = sources[right].lotteryId, key = `${leftId}|${rightId}`, relation = familyById.get(leftId) === familyById.get(rightId) ? "within" : "between", item = signalAccumulator.get(key) ?? { left: leftId, right: rightId, relation, dates: 0, cosine: 0, pearson: 0, overlap: 0 };
    item.dates += 1; item.cosine += cosineSimilarity(a.vector, b.vector); item.pearson += pearsonCorrelation(a.vector, b.vector); item.overlap += topSetOverlap(a.vector, b.vector); signalAccumulator.set(key, item);
  }
  for (const familyId of familyIds) {
    const reduced = sources.filter((source) => familyById.get(source.lotteryId) !== familyId), without = buildGlobalWeekdayWin(reduced, { weekday: drawWeekday(date) as 0|1|2|3|4|5|6, cutoffDate: date }).rankedDigits.slice(0, 6).map((item) => item.digit), comparison = compareTop6Membership(normal, without), item = sensitivity.get(familyId)!;
    item.dates += 1; item.overlap += comparison.overlap; item.changed += comparison.changedDigits; item.exactOrder += Number(comparison.exactSameOrder);
  }
}

const signalPairs: SignalPair[] = [...signalAccumulator.values()].filter((item) => item.dates >= MIN_OVERLAP).map((item) => ({ left: item.left, right: item.right, familyRelation: item.relation, dates: item.dates, cosineMean: item.cosine / item.dates, pearsonMean: item.pearson / item.dates, top6OverlapMean: item.overlap / item.dates }));
function quantile(values: number[], probability: number) { if (!values.length) return 0; const sorted = [...values].sort((a,b)=>a-b), index=(sorted.length-1)*probability, lower=Math.floor(index), upper=Math.ceil(index), weight=index-lower; return sorted[lower]*(1-weight)+sorted[upper]*weight; }
function distribution<T>(items: T[], value: (item:T)=>number) { const values=items.map(value); return { count: values.length, mean: values.length ? values.reduce((a,b)=>a+b,0)/values.length : 0, median: quantile(values,0.5), p75:quantile(values,0.75),p90:quantile(values,0.9),max:values.length?Math.max(...values):0 }; }
const comparableOutcomes = outcomePairs.filter((item) => item.overlap >= MIN_OVERLAP), withinOutcome = comparableOutcomes.filter((item) => item.familyRelation === "within"), betweenOutcome = comparableOutcomes.filter((item) => item.familyRelation === "between"), withinSignal = signalPairs.filter((item) => item.familyRelation === "within"), betweenSignal = signalPairs.filter((item) => item.familyRelation === "between"),
  comparisons = {
    outcomeExactEither: { within: distribution(withinOutcome, (item)=>item.exactEitherRate), between: distribution(betweenOutcome,(item)=>item.exactEitherRate) },
    outcomeCombinedJaccard: { within: distribution(withinOutcome,(item)=>item.combinedDigitPresenceJaccard), between:distribution(betweenOutcome,(item)=>item.combinedDigitPresenceJaccard) },
    signalCosine: { within: distribution(withinSignal,(item)=>item.cosineMean), between:distribution(betweenSignal,(item)=>item.cosineMean) },
    signalTop6Overlap: { within: distribution(withinSignal,(item)=>item.top6OverlapMean), between:distribution(betweenSignal,(item)=>item.top6OverlapMean) },
  };
const families = familyIds.map((familyId) => {
  const members=mappings.filter((item)=>item.familyId===familyId), eligibility=familyEligibility.get(familyId)!, familySignals=withinSignal.filter((pair)=>familyById.get(pair.left)===familyId), sensitivityItem=sensitivity.get(familyId)!;
  const signalCosineMean=distribution(familySignals,(item)=>item.cosineMean).mean, signalTop6OverlapMean=distribution(familySignals,(item)=>item.top6OverlapMean).mean,
    potentialRedundancy=members.length>1 && familySignals.length>0 && signalCosineMean>comparisons.signalCosine.between.p75 && signalTop6OverlapMean>comparisons.signalTop6Overlap.between.p75;
  return { familyId, familyLabel:members[0].familyLabel, sourceIds:members.map((item)=>item.lotteryId), sourceCount:members.length, poolShare:members.length/39, averageEligibleSourcesPerDate:auditDates.length?eligibility.eligible/auditDates.length:0, averageHistoryCoverage:eligibility.eligible?eligibility.history/eligibility.eligible:0, withinSignalPairCount:familySignals.length, averageWithinSignalCosine:signalCosineMean, averageWithinTop6Overlap:signalTop6OverlapMean, potentialRedundancy, leaveOneFamilyOut:{ dates:sensitivityItem.dates, averageTop6Overlap:sensitivityItem.dates?sensitivityItem.overlap/sensitivityItem.dates:0, averageChangedDigits:sensitivityItem.dates?sensitivityItem.changed/sensitivityItem.dates:0, exactSameOrderRate:sensitivityItem.dates?sensitivityItem.exactOrder/sensitivityItem.dates:0 } };
}).sort((a,b)=>b.sourceCount-a.sourceCount||a.familyId.localeCompare(b.familyId));
const overlapDistribution=distribution(outcomePairs,(item)=>item.overlap), notableOutcomePairs=[...comparableOutcomes].sort((a,b)=>b.exactEitherUpliftVsUniform-a.exactEitherUpliftVsUniform||b.overlap-a.overlap).slice(0,15), notableSignalPairs=[...signalPairs].sort((a,b)=>b.cosineMean-a.cosineMean||b.dates-a.dates).slice(0,15), flaggedFamilies=families.filter((item)=>item.potentialRedundancy),
  conclusion=flaggedFamilies.length ? "Measurable structural-family similarity exists, but this audit does not justify changing production weights or membership." : "No meaningful evidence of source-family redundancy under the pre-registered diagnostic rule.";
const result={protocol,protocolHash,historyHash,data:{range:[allDates[0],allDates.at(-1)],storedSources:stored.length,readOnlyHydrated:hydrated.map((item)=>item.lotteryId),auditDates:auditDates.length,totalSourcePairs:outcomePairs.length,comparableOutcomePairs:comparableOutcomes.length,signalPairs:signalPairs.length,overlapDistribution},mappings,outcomePairs,signalPairs,comparisons,families,notableOutcomePairs,notableSignalPairs,conclusion};

const pct=(value:number)=>`${(value*100).toFixed(2)}%`, fixed=(value:number)=>value.toFixed(3), dist=(value:ReturnType<typeof distribution>)=>`${value.count} | ${pct(value.mean)} | ${pct(value.median)} | ${pct(value.p75)} | ${pct(value.p90)} | ${pct(value.max)}`,
  mappingRows=mappings.map((item)=>`| ${item.lotteryId} | ${item.displayName} | ${item.familyId} | ${item.familyLabel} | ${item.variant} | ${item.rationale} | ${item.liveProviderUrl??"not recorded"} |`).join("\n"),
  familyRows=families.map((item)=>`| ${item.familyLabel} | ${item.sourceCount} | ${pct(item.poolShare)} | ${item.averageEligibleSourcesPerDate.toFixed(2)} | ${item.averageHistoryCoverage.toFixed(2)} | ${fixed(item.averageWithinSignalCosine)} | ${pct(item.averageWithinTop6Overlap)} | ${item.potentialRedundancy?"potential":"no"} |`).join("\n"),
  outcomeRows=notableOutcomePairs.map((item)=>`| ${item.left} | ${item.right} | ${item.familyRelation} | ${item.overlap} | ${pct(item.exactTopRate)} | ${pct(item.exactBottomRate)} | ${pct(item.exactEitherRate)} | ${pct(item.exactEitherUpliftVsUniform)} | ${pct(item.combinedDigitPresenceJaccard)} |`).join("\n"),
  signalRows=notableSignalPairs.map((item)=>`| ${item.left} | ${item.right} | ${item.familyRelation} | ${item.dates} | ${fixed(item.cosineMean)} | ${fixed(item.pearsonMean)} | ${pct(item.top6OverlapMean)} |`).join("\n"),
  sensitivityRows=families.map((item)=>`| ${item.familyLabel} | ${item.sourceCount} | ${item.leaveOneFamilyOut.dates} | ${item.leaveOneFamilyOut.averageTop6Overlap.toFixed(2)}/6 | ${item.leaveOneFamilyOut.averageChangedDigits.toFixed(2)} | ${pct(item.leaveOneFamilyOut.exactSameOrderRate)} |`).join("\n"),
  report=`# Global source-family redundancy audit\n\nFreeze date: ${FREEZE_DATE}  \nCode baseline: \`main@f0b28b4\`  \nProtocol fingerprint: \`${protocolHash}\`  \nHistory fingerprint: \`${historyHash}\`\n\n## Audit goal\n\nMeasure source-level outcome similarity separately from family-level structural and production-signal similarity. This is a read-only data-quality audit, not model selection or predictive-performance research.\n\nStructural family similarity does not equal predictive redundancy, and this audit does not permit interpreting any family as better or worse.\n\n## Frozen production universe and classification\n\n- Exact current production pool: **39 lotteries** from \`GLOBAL_DAILY_SOURCE_IDS\`.\n- Ambiguous names are retained as singleton families. Structural grouping does not itself imply statistical redundancy.\n\n| Lottery ID | Display name | Family ID | Family | Variant | Rationale | Live provider metadata |\n|---|---|---|---|---|---|---|\n${mappingRows}\n\nAmbiguous singleton classifications: **${mappings.filter((item)=>item.ambiguous).length}**.\n\n## Data and sample guards\n\n- Period: ${result.data.range[0]} to ${result.data.range[1]}\n- Historical target dates used for leakage-safe signals: ${result.data.auditDates}\n- Source pairs: ${result.data.totalSourcePairs}; pairs with >=${MIN_OVERLAP} aligned complete dates: ${result.data.comparableOutcomePairs}\n- Outcome overlap distribution: mean ${fixed(overlapDistribution.mean)}, median ${fixed(overlapDistribution.median)}, P75 ${fixed(overlapDistribution.p75)}, P90 ${fixed(overlapDistribution.p90)}, max ${fixed(overlapDistribution.max)} dates.\n- <${MIN_OVERLAP} aligned dates: insufficient; ${MIN_OVERLAP}-${STRONGER_OVERLAP-1}: descriptive; >=${STRONGER_OVERLAP}: stronger-sample interpretation.\n- Exact top/bottom agreement uses a 1% uniform null and either-side agreement a 1.99% null. Digit overlap and signal similarities are descriptive because no single clean universal null was imposed.\n- Stored sources: ${stored.length}/39; read-only hydration: ${hydrated.map((item)=>item.lotteryId).join(", ")||"none"}.\n\n## Within-family vs between-family distributions\n\n| Metric | Relation | Pair count | Mean | Median | P75 | P90 | Max |\n|---|---|---:|---:|---:|---:|---:|---:|\n| Exact either-side agreement | within | ${dist(comparisons.outcomeExactEither.within)} |\n| Exact either-side agreement | between | ${dist(comparisons.outcomeExactEither.between)} |\n| Combined digit-set Jaccard | within | ${dist(comparisons.outcomeCombinedJaccard.within)} |\n| Combined digit-set Jaccard | between | ${dist(comparisons.outcomeCombinedJaccard.between)} |\n| Signal cosine | within | ${dist(comparisons.signalCosine.within)} |\n| Signal cosine | between | ${dist(comparisons.signalCosine.between)} |\n| Signal Top-6 overlap | within | ${dist(comparisons.signalTop6Overlap.within)} |\n| Signal Top-6 overlap | between | ${dist(comparisons.signalTop6Overlap.between)} |\n\n## Most notable source-level outcome pairs\n\n| Source A | Source B | Relation | Dates | Exact top | Exact bottom | Exact either | Either uplift vs uniform | Combined digit Jaccard |\n|---|---|---|---:|---:|---:|---:|---:|---:|\n${outcomeRows}\n\n## Most similar leakage-safe signal pairs\n\nSignals use only same-weekday history strictly before each target date, maximum 12 observations per lottery, and at least ${MIN_SIGNAL_HISTORY} observations.\n\n| Source A | Source B | Relation | Dates | Cosine | Pearson | Top-6 overlap |\n|---|---|---|---:|---:|---:|---:|\n${signalRows}\n\n## Family contribution diagnostic\n\n| Family | Sources | Pool share | Avg eligible sources/date | Avg history | Within signal cosine | Within Top-6 overlap | Rule flag |\n|---|---:|---:|---:|---:|---:|---:|---|\n${familyRows}\n\nFamilies meeting the pre-registered diagnostic rule: **${flaggedFamilies.map((item)=>item.familyLabel).join(", ")||"none"}**. A flag means only potential redundancy worth knowing about.\n\n## Leave-one-family-out Top 6 sensitivity\n\nNo outcomes or hit rates are evaluated after removal.\n\n| Family | Sources | Dates | Avg membership overlap | Avg changed digits | Exact same order |\n|---|---:|---:|---:|---:|---:|\n${sensitivityRows}\n\n## Conclusion\n\n**${conclusion}**\n\nNo production action is justified by this audit. It does not test whether removing or reweighting a family improves future results.\n\n## Limitations\n\n- Structural families are conservative metadata classifications, not causal relationships.\n- Uniform exact-agreement nulls do not model source-specific marginal digit distributions.\n- Vector similarity is descriptive and can be high because all ten digits have broadly similar base rates.\n- Related schedules and market labels do not prove shared result generation.\n- Leave-one-family-out measures ranking sensitivity only, never predictive performance.\n\n## Contract confirmation\n\n- Production formula changed: **NO**\n- Production pool changed: **NO**\n- Production UI changed: **NO**\n- Prospective tracking added: **NO**\n`;
async function freezeFile(file:string,content:string){try{const existing=await fs.readFile(file,"utf8");if(existing!==content)throw new Error(`Frozen report already exists with different content: ${file}`);}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;await fs.writeFile(file,content,"utf8");}}
const reports=path.join(process.cwd(),"reports");await fs.mkdir(reports,{recursive:true});await freezeFile(path.join(reports,`${REPORT_BASE}.json`),`${JSON.stringify(result,null,2)}\n`);await freezeFile(path.join(reports,`${REPORT_BASE}.md`),report);console.log(JSON.stringify({report:`reports/${REPORT_BASE}.md`,protocolHash,historyHash,data:result.data,comparisons,flaggedFamilies:flaggedFamilies.map((item)=>item.familyId),conclusion},null,2));
