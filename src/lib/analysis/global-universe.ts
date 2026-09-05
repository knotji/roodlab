import type { Snapshot } from "../cache";
import type { LotteryDefinition, LotteryDraw } from "../types";
import { exclusionReasonCounts, resolveGlobalDailySources, type GlobalDailyEligibility } from "./global-daily-eligibility";
import { GLOBAL_DAILY_SOURCE_IDS } from "./global-daily-sources";
import { buildGlobalWeekdayWin, type GlobalWeekdayWinResult } from "./global-weekday-win";
import { resolvePlayedUniverseSourceIds, type PlayedUniverseWeekday } from "./played-universe";

/** Frozen legacy research universe (46 sources). Research comparison only - never a production default. */
export const LEGACY_GLOBAL_46_SOURCE_IDS = GLOBAL_DAILY_SOURCE_IDS;

export type GlobalUniverseMode = "all_eligible" | "legacy_46" | "played";

/**
 * Restricts the canonical catalog to a source universe before handing it to the
 * unchanged `resolveGlobalDailySources` / `buildGlobalWeekdayWin` pipeline. This is
 * the only thing that differs between universes - eligibility rules and scoring are
 * shared and untouched. `all_eligible` returns the catalog unchanged, which is
 * exactly what production (`/api/global-weekday-win`) already does.
 */
export function resolveUniverseCatalog(
  catalog: LotteryDefinition[],
  mode: GlobalUniverseMode,
  weekday: PlayedUniverseWeekday,
): LotteryDefinition[] {
  if (mode === "all_eligible") return catalog;
  const allowed = new Set<string>(mode === "legacy_46" ? LEGACY_GLOBAL_46_SOURCE_IDS : resolvePlayedUniverseSourceIds(weekday));
  return catalog.filter((lottery) => allowed.has(lottery.id));
}

export type ProductionGlobalUniverseMode = "played" | "all_eligible_fallback";

export type ProductionGlobalUniverseResolution = {
  mode: ProductionGlobalUniverseMode;
  weekday: PlayedUniverseWeekday;
  configuredCount: number;
  eligibleCount: number;
  sources: Snapshot[];
  eligibility: GlobalDailyEligibility[];
};

/**
 * Resolves the SOURCE UNIVERSE Production Global Win should use for `weekday`: the
 * configured Played Universe for Monday-Saturday, or an explicit Dynamic All Eligible
 * fallback for Sunday (which has no configured list yet). An empty Played Universe
 * config is never silently treated as "zero sources" - it always means "fall back to
 * All Eligible", so Sunday keeps producing a normal Win 6.
 *
 * This is a pure source-universe decision. It calls the existing, unmodified
 * `resolveGlobalDailySources` eligibility pipeline - suspension, missing/incomplete
 * history, and same-weekday sufficiency rules are untouched.
 */
export function resolveProductionGlobalUniverse(input: {
  catalog: LotteryDefinition[];
  snapshots: Record<string, Snapshot>;
  targetDate: string;
  weekday: PlayedUniverseWeekday;
  historical?: boolean;
  audit?: Record<string, { status: "supported" | "partial" | "failed" }>;
}): ProductionGlobalUniverseResolution {
  const configuredIds = resolvePlayedUniverseSourceIds(input.weekday),
    mode: ProductionGlobalUniverseMode = configuredIds.length > 0 ? "played" : "all_eligible_fallback",
    universeCatalog = mode === "played" ? resolveUniverseCatalog(input.catalog, "played", input.weekday) : input.catalog,
    resolved = resolveGlobalDailySources({
      catalog: universeCatalog,
      snapshots: input.snapshots,
      targetDate: input.targetDate,
      weekday: input.weekday,
      historical: input.historical,
      audit: input.audit,
    });
  return {
    mode,
    weekday: input.weekday,
    configuredCount: universeCatalog.length,
    eligibleCount: resolved.sources.length,
    sources: resolved.sources,
    eligibility: resolved.eligibility,
  };
}

/**
 * Composes `resolveProductionGlobalUniverse` with the unchanged
 * `buildGlobalWeekdayWin` scoring engine. This is the single function production
 * (`/api/global-weekday-win`) and Gemini's evidence builder should both call, so they
 * never resolve conflicting source universes for the same target date.
 */
export function buildProductionGlobalWeekdayWin(input: {
  catalog: LotteryDefinition[];
  snapshots: Record<string, Snapshot>;
  targetDate: string;
  weekday: PlayedUniverseWeekday;
  historical?: boolean;
  audit?: Record<string, { status: "supported" | "partial" | "failed" }>;
}): { universe: ProductionGlobalUniverseResolution; result: GlobalWeekdayWinResult } {
  const universe = resolveProductionGlobalUniverse(input),
    result = buildGlobalWeekdayWin(universe.sources, { weekday: input.weekday, cutoffDate: input.targetDate });
  return { universe, result };
}

export type GlobalUniverseWinResult = {
  mode: GlobalUniverseMode;
  result: GlobalWeekdayWinResult;
  eligibility: GlobalDailyEligibility[];
  universeCatalogSize: number;
  eligibilitySummary: {
    totalCatalog: number;
    eligible: number;
    excluded: number;
    exclusionReasons: Record<string, number>;
  };
};

/**
 * Composes the source-universe resolver with the unchanged Production Global Win
 * eligibility and scoring pipeline. There is one scoring engine
 * (`buildGlobalWeekdayWin`); this function only swaps which sources reach it.
 */
export function buildGlobalWeekdayWinForUniverse(input: {
  mode: GlobalUniverseMode;
  catalog: LotteryDefinition[];
  snapshots: Record<string, Snapshot>;
  targetDate: string;
  weekday: PlayedUniverseWeekday;
  historical?: boolean;
  audit?: Record<string, { status: "supported" | "partial" | "failed" }>;
}): GlobalUniverseWinResult {
  const universeCatalog = resolveUniverseCatalog(input.catalog, input.mode, input.weekday),
    resolved = resolveGlobalDailySources({
      catalog: universeCatalog,
      snapshots: input.snapshots,
      targetDate: input.targetDate,
      weekday: input.weekday,
      historical: input.historical,
      audit: input.audit,
    }),
    result = buildGlobalWeekdayWin(resolved.sources, { weekday: input.weekday, cutoffDate: input.targetDate });
  return {
    mode: input.mode,
    result,
    eligibility: resolved.eligibility,
    universeCatalogSize: universeCatalog.length,
    eligibilitySummary: {
      totalCatalog: universeCatalog.length,
      eligible: resolved.sources.length,
      excluded: universeCatalog.length - resolved.sources.length,
      exclusionReasons: exclusionReasonCounts(resolved.eligibility),
    },
  };
}

/**
 * Resolves the fixed outcome population for a comparison evaluation: the Played
 * Universe intersected with sources that report a complete top2/bottom2 draw on
 * `date`. Takes no universe `mode` parameter by design - every strategy in a
 * comparison must be graded against this exact same population, never against its
 * own universe.
 */
export function resolvePlayedUniverseTargets(input: {
  catalog: LotteryDefinition[];
  snapshots: Record<string, Snapshot>;
  weekday: PlayedUniverseWeekday;
  date: string;
}): Array<{ lotteryId: string; top2: string; bottom2: string }> {
  const playedIds = new Set(resolvePlayedUniverseSourceIds(input.weekday)),
    playedCatalog = input.catalog.filter((lottery) => playedIds.has(lottery.id));
  return playedCatalog.flatMap((lottery) =>
    (input.snapshots[lottery.id]?.draws ?? [])
      .filter((draw): draw is LotteryDraw & { top2: string; bottom2: string } => draw.drawDate === input.date && Boolean(draw.top2) && Boolean(draw.bottom2))
      .map((draw) => ({ lotteryId: lottery.id, top2: draw.top2, bottom2: draw.bottom2 })),
  );
}
