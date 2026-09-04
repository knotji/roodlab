import { performance } from "node:perf_hooks";
import type { Snapshot } from "./cache";
import { readAllSnapshots, readCatalog, readCatalogAudit, readSnapshot, writeCatalog } from "./cache";
import { getCanonicalSupportedLotteries, validateCanonicalLotteryCatalog } from "./canonical-lottery-catalog";
import { AllHuayDataSource } from "./data-sources/allhuay";
import { isCompleteDraw, validateHistoryIntegrity } from "./data-sources/integrity";
import { syncLotteryFromSource } from "./sync-service";
import type { LotteryDefinition } from "./types";

export type AllLotterySyncItem = {
  id: string;
  name: string;
  attempted: boolean;
  outcome: "updated" | "unchanged" | "failed";
  storedDrawCount: number;
  completeDrawCount: number;
  latestObservedDraw: string | null;
  latestCompleteDraw: string | null;
  completeness: "complete" | "partial" | "invalid" | "missing";
  freshnessStatus: string;
  providerResultStatus: "normal" | "suspended" | "unknown";
  historyVersion: string | null;
  error?: string;
};

export type AllLotterySyncSummary = {
  totalCatalog: number;
  supported: number;
  attempted: number;
  updated: number;
  unchanged: number;
  failed: number;
  partial: number;
  invalid: number;
  stale: number;
  freshnessUnknown: number;
  suspended: number;
  complete: number;
  stored: number;
  latestCompleteDate: string | null;
  durationMs: number;
  items: AllLotterySyncItem[];
};

export async function runBounded<T, R>(items: T[], concurrency: number, task: (item: T) => Promise<R>) {
  const queue = [...items], results: R[] = [];
  async function worker() {
    while (queue.length) {
      const item = queue.shift();
      if (item === undefined) return;
      results.push(await task(item));
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, worker));
  return results;
}

function describe(lottery: LotteryDefinition, snapshot: Snapshot | undefined, outcome: AllLotterySyncItem["outcome"], error?: string): AllLotterySyncItem {
  const draws = snapshot?.draws ?? [], complete = draws.filter(isCompleteDraw), issues = snapshot ? validateHistoryIntegrity(draws, lottery.id) : [];
  return {
    id: lottery.id,
    name: lottery.name,
    attempted: true,
    outcome,
    storedDrawCount: draws.length,
    completeDrawCount: complete.length,
    latestObservedDraw: draws[0]?.drawDate ?? null,
    latestCompleteDraw: complete[0]?.drawDate ?? null,
    completeness: !snapshot ? "missing" : issues.length ? "invalid" : complete.length === draws.length ? "complete" : "partial",
    freshnessStatus: snapshot?.freshness?.status ?? "unknown",
    providerResultStatus: snapshot?.providerResultStatus ?? "unknown",
    historyVersion: snapshot?.historyVersion ?? null,
    ...(error ? { error } : {}),
  };
}

export async function syncAllLotteries(options: {
  concurrency?: number;
  retries?: number;
  catalog?: LotteryDefinition[];
  audit?: Record<string, { status: "supported" | "partial" | "failed"; reason?: string }>;
  discoverCatalog?: () => Promise<LotteryDefinition[]>;
  syncOne?: typeof syncLotteryFromSource;
  readOne?: typeof readSnapshot;
  readAll?: typeof readAllSnapshots;
  persistCatalog?: boolean;
  onProgress?: (completed: number, total: number, item: AllLotterySyncItem) => void;
} = {}): Promise<AllLotterySyncSummary> {
  const started = performance.now(), existingCatalog = options.catalog ?? await readCatalog(), audit = options.audit ?? await readCatalogAudit(),
    discovered = options.catalog ? validateCanonicalLotteryCatalog(options.catalog) : validateCanonicalLotteryCatalog(await (options.discoverCatalog ?? (() => new AllHuayDataSource().getLotteries()))()),
    catalog = discovered.length ? discovered : existingCatalog;
  if (!options.catalog && discovered.length && options.persistCatalog !== false) await writeCatalog(discovered);
  const supported = getCanonicalSupportedLotteries(catalog, audit), syncOne = options.syncOne ?? syncLotteryFromSource,
    readOne = options.readOne ?? readSnapshot, readAll = options.readAll ?? readAllSnapshots,
    retries = options.retries ?? 1;
  let completed = 0;
  const outcomes = await runBounded(supported, options.concurrency ?? 3, async (lottery) => {
    let error = "unknown sync failure";
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const result = await syncOne(lottery.id, { reconcileProspective: false });
        const snapshot = await readOne(lottery.id) ?? undefined;
        const item = describe(lottery, snapshot, result.outcome);
        options.onProgress?.(++completed, supported.length, item);
        return item;
      } catch (cause) {
        error = cause instanceof Error ? cause.message : "sync failed";
      }
    }
    const snapshot = await readOne(lottery.id) ?? undefined;
    const item = describe(lottery, snapshot, "failed", error);
    options.onProgress?.(++completed, supported.length, item);
    return item;
  });
  const snapshots = await readAll(), items = outcomes.sort((a, b) => a.id.localeCompare(b.id)),
    latestCompleteDate = items.map((item) => item.latestCompleteDraw).filter((date): date is string => Boolean(date)).sort().at(-1) ?? null;
  return {
    totalCatalog: catalog.length,
    supported: supported.length,
    attempted: items.length,
    updated: items.filter((item) => item.outcome === "updated").length,
    unchanged: items.filter((item) => item.outcome === "unchanged").length,
    failed: items.filter((item) => item.outcome === "failed").length,
    partial: items.filter((item) => item.completeness === "partial").length,
    invalid: items.filter((item) => item.completeness === "invalid").length,
    stale: items.filter((item) => item.freshnessStatus === "cache-behind").length,
    freshnessUnknown: items.filter((item) => item.freshnessStatus === "unknown").length,
    suspended: items.filter((item) => item.providerResultStatus === "suspended").length,
    complete: items.filter((item) => item.completeDrawCount > 0).length,
    stored: supported.filter((lottery) => snapshots[lottery.id]).length,
    latestCompleteDate,
    durationMs: Math.round(performance.now() - started),
    items,
  };
}
