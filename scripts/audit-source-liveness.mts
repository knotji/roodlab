import nextEnv from "@next/env";
import { createHash } from "node:crypto";
import { atomicWriteFile, readAllSnapshots } from "../src/lib/cache";
import { AllHuayDataSource } from "../src/lib/data-sources/allhuay";
import { isCompleteDraw } from "../src/lib/data-sources/integrity";
import { runBounded } from "../src/lib/all-lottery-sync";
import { ageInDays, classifySourceLiveness, completeDrawGaps } from "../src/lib/source-liveness";

nextEnv.loadEnvConfig(process.cwd());
const TARGET_DATE = "2026-09-04", CUTOFF_DATE = "2026-09-02", BASELINE = "e427e3a";
const snapshots = await readAllSnapshots(), candidates = Object.values(snapshots).map((snapshot) => ({ snapshot, latestComplete: snapshot.draws.find(isCompleteDraw)?.drawDate ?? null })).filter((item) => item.latestComplete && item.latestComplete < CUTOFF_DATE).sort((a, b) => a.snapshot.lotteryId.localeCompare(b.snapshot.lotteryId));
const provider = new AllHuayDataSource(), liveCatalog = await provider.getLotteries(), byId = new Map(liveCatalog.map((lottery) => [lottery.id, lottery]));
const rows = (await runBounded(candidates, 3, async ({ snapshot, latestComplete }) => {
  const catalogEntry = byId.get(snapshot.lotteryId), gaps = completeDrawGaps(snapshot.draws), cadence = classifySourceLiveness({ ageDays: ageInDays(TARGET_DATE, latestComplete!), gaps });
  try {
    const live = catalogEntry ? await new AllHuayDataSource(liveCatalog).getCanonicalHistory(snapshot.lotteryId, { limit: 40 }) : null,
      liveComplete = live?.draws.find(isCompleteDraw)?.drawDate ?? null;
    return { id: snapshot.lotteryId, name: catalogEntry?.name ?? snapshot.lotteryId, storedLatestComplete: latestComplete, providerCatalogPresent: Boolean(catalogEntry), providerPageReachable: Boolean(live), providerTemplate: live?.template ?? null, providerLatestObserved: live?.currentSourceResultDate ?? live?.draws[0]?.drawDate ?? null, providerLatestComplete: liveComplete, completeDrawCount: snapshot.draws.filter(isCompleteDraw).length, gapSamples: gaps.length, ...cadence, classification: !catalogEntry || !live ? "unknown" as const : cadence.status, error: null as string | null };
  } catch (error) {
    return { id: snapshot.lotteryId, name: catalogEntry?.name ?? snapshot.lotteryId, storedLatestComplete: latestComplete, providerCatalogPresent: Boolean(catalogEntry), providerPageReachable: false, providerTemplate: null, providerLatestObserved: null, providerLatestComplete: null, completeDrawCount: snapshot.draws.filter(isCompleteDraw).length, gapSamples: gaps.length, ...cadence, classification: "unknown" as const, error: error instanceof Error ? error.message : "provider check failed" };
  }
})).sort((a, b) => a.id.localeCompare(b.id));
const counts = rows.reduce<Record<string, number>>((result, row) => { result[row.classification] = (result[row.classification] ?? 0) + 1; return result; }, {}),
  result = { freezeDate: TARGET_DATE, codeBaseline: `main@${BASELINE} with uncommitted all-lottery foundation`, protocol: { candidateRule: `stored latest complete before ${CUTOFF_DATE}`, cadence: "unique complete-draw calendar gaps per source", percentile: "nearest rank", activeLike: "gap samples >=10 and age/P90 <=2", dormantLike: "gap samples >=10 and age/P90 >=5", unknown: "ratio between thresholds, insufficient samples, missing catalog entry, or unreachable page", operationalOnly: true, productionExclusionAuthorized: false }, catalog: { currentProviderEntries: liveCatalog.length, fingerprint: createHash("sha256").update(JSON.stringify(liveCatalog)).digest("hex").slice(0, 16) }, candidates: rows.length, counts, rows };
const table = rows.map((row) => `| \`${row.id}\` | ${row.name} | ${row.storedLatestComplete} | ${row.providerCatalogPresent ? "yes" : "no"} | ${row.providerPageReachable ? "yes" : "no"} | ${row.providerLatestComplete ?? "--"} | ${row.completeDrawCount} | ${row.medianGapDays ?? "--"} | ${row.p90GapDays ?? "--"} | ${row.ageToP90Ratio?.toFixed(1) ?? "--"}× | **${row.classification}** |`).join("\n"),
  report = `# Source liveness audit

Freeze date: ${TARGET_DATE}
Code baseline: \`main@${BASELINE}\` plus the uncommitted all-lottery foundation
Provider catalog fingerprint: \`${result.catalog.fingerprint}\`

## Scope

Read-only operational audit of sources whose stored latest complete draw predates ${CUTOFF_DATE}. This does not change Global Daily eligibility, scoring, weights, or source membership and does not evaluate predictive performance.

Provider/cache synchronization and current series liveness are separate concepts.

## Pre-registered classification

- Cadence uses calendar-day gaps between unique complete draws from that source only.
- Median and P90 use nearest-rank percentiles.
- Active-like: at least 10 gap samples and age/P90 <= 2.
- Dormant-like: at least 10 gap samples and age/P90 >= 5.
- Unknown: between thresholds, insufficient history, absent from current catalog, or provider page unreachable.
- Labels are operational triage only. Production exclusion is **not authorized** by this audit.

## Results

- Current provider catalog: ${liveCatalog.length}
- Candidates: ${rows.length}
- Active-like: ${counts["active-like"] ?? 0}; dormant-like: ${counts["dormant-like"] ?? 0}; unknown: ${counts.unknown ?? 0}
- The 13 sources highlighted in the review are the 2 dated 2026-08-16 plus 11 dated 2026-06-22/23. The literal "before 2026-09-02" rule also includes two sources dated 2026-09-01 and one dated 2026-08-31, so this audit reports all 16 rather than silently dropping the boundary-near cases.

| ID | Name | Stored latest complete | In current catalog | Page reachable | Provider latest complete | Complete draws | Median gap | P90 gap | Age/P90 | Status |
|---|---|---:|:---:|:---:|---:|---:|---:|---:|---:|---|
${table}

## Interpretation boundary

Presence in the current provider catalog means the provider still exposes the series; it does not prove draws are ongoing. A reachable page with an old latest result plus an age far beyond its own historical P90 is evidence of dormant-like behavior, not proof of permanent discontinuation. Review is required before any eligibility migration.

All 11 dormant-like rows belong to the Maekhong group. Their provider pages remain reachable and expose current-dated rows through 2026-09-03, but the raw provider hero and table explicitly display "งด" instead of top3, top2, and bottom2 values; their last complete outcomes remain 2026-06-22/23. This rules out a parser miss for the sampled pages. Operationally this is "catalog/page alive, usable result series dormant-like", not proof that the provider entry has been removed.
`;
await atomicWriteFile(`reports/source-liveness-audit-${TARGET_DATE}.json`, JSON.stringify(result, null, 2));
await atomicWriteFile(`reports/source-liveness-audit-${TARGET_DATE}.md`, report);
console.log(JSON.stringify({ candidates: rows.length, counts, rows }, null, 2));
