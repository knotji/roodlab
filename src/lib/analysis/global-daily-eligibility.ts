import type { Snapshot, SnapshotFreshness } from "../cache";
import { isCompleteDraw, validateHistoryIntegrity } from "../data-sources/integrity";
import type { LotteryDefinition } from "../types";
import { drawWeekday, type DayPattern } from "./day-pattern";
import { GLOBAL_WEEKDAY_LOOKBACK } from "./global-weekday-win";

export const GLOBAL_DAILY_MIN_SAME_WEEKDAY_HISTORY = 1;

export type GlobalDailyExclusionReason =
  | "unsupported"
  | "missing-history"
  | "no-complete-history"
  | "invalid-history"
  | "insufficient-same-weekday-history"
  | "known-stale";

export type GlobalDailyEligibility = {
  lotteryId: string;
  eligible: boolean;
  reasons: GlobalDailyExclusionReason[];
  completeHistoryCount: number;
  sameWeekdayHistoryCount: number;
  latestObservedDate: string | null;
  latestCompleteDate: string | null;
  freshnessStatus: SnapshotFreshness["status"] | "unknown";
};

export function getGlobalDailyEligibility(input: {
  lottery: LotteryDefinition;
  snapshot?: Snapshot | null;
  targetDate: string;
  weekday: Exclude<DayPattern, "all">;
  historical?: boolean;
  auditStatus?: "supported" | "partial" | "failed";
}): GlobalDailyEligibility {
  const { lottery, snapshot, targetDate, weekday } = input,
    reasons: GlobalDailyExclusionReason[] = [],
    allDraws = snapshot?.draws ?? [],
    preTarget = allDraws.filter((draw) => draw.drawDate < targetDate),
    complete = preTarget.filter(isCompleteDraw),
    sameWeekday = complete
      .filter((draw) => drawWeekday(draw.drawDate) === weekday)
      .sort((a, b) => b.drawDate.localeCompare(a.drawDate))
      .slice(0, GLOBAL_WEEKDAY_LOOKBACK),
    issues = validateHistoryIntegrity(preTarget, lottery.id);

  if (lottery.isActive === false || input.auditStatus === "failed") reasons.push("unsupported");
  if (!snapshot || !allDraws.length) reasons.push("missing-history");
  else if (!complete.length) reasons.push("no-complete-history");
  if (issues.length) reasons.push("invalid-history");
  if (sameWeekday.length < GLOBAL_DAILY_MIN_SAME_WEEKDAY_HISTORY)
    reasons.push("insufficient-same-weekday-history");
  // Current freshness compares provider and cache, not calendar schedules. Only a
  // positively known stale cache is excluded; historical eligibility never uses today's state.
  if (!input.historical && snapshot?.freshness?.status === "cache-behind") reasons.push("known-stale");

  return {
    lotteryId: lottery.id,
    eligible: reasons.length === 0,
    reasons,
    completeHistoryCount: complete.length,
    sameWeekdayHistoryCount: sameWeekday.length,
    latestObservedDate: allDraws[0]?.drawDate ?? null,
    latestCompleteDate: allDraws.find(isCompleteDraw)?.drawDate ?? null,
    freshnessStatus: snapshot?.freshness?.status ?? "unknown",
  };
}

export function resolveGlobalDailySources(input: {
  catalog: LotteryDefinition[];
  snapshots: Record<string, Snapshot>;
  targetDate: string;
  weekday: Exclude<DayPattern, "all">;
  historical?: boolean;
  audit?: Record<string, { status: "supported" | "partial" | "failed" }>;
}) {
  const seen = new Set<string>(), eligibility = input.catalog.map((lottery) => {
    if (seen.has(lottery.id)) throw new Error(`duplicate canonical lottery id: ${lottery.id}`);
    seen.add(lottery.id);
    return getGlobalDailyEligibility({
      lottery,
      snapshot: input.snapshots[lottery.id],
      targetDate: input.targetDate,
      weekday: input.weekday,
      historical: input.historical,
      auditStatus: input.audit?.[lottery.id]?.status,
    });
  }), eligibleIds = new Set(eligibility.filter((item) => item.eligible).map((item) => item.lotteryId)),
    sources = input.catalog
      .filter((lottery) => eligibleIds.has(lottery.id))
      .map((lottery) => input.snapshots[lottery.id])
      .filter((snapshot): snapshot is Snapshot => Boolean(snapshot));
  return { sources, eligibility };
}

export function exclusionReasonCounts(items: GlobalDailyEligibility[]) {
  return items.flatMap((item) => item.reasons).reduce<Record<string, number>>((counts, reason) => {
    counts[reason] = (counts[reason] ?? 0) + 1;
    return counts;
  }, {});
}
