import type { Snapshot } from "../cache";
import { isLiveResultDay, LIVE_RESULT_SOURCES } from "../live-results";
import type { LotteryDefinition } from "../types";
import { exclusionReasonCounts, resolveGlobalDailySources, type GlobalDailyEligibility } from "./global-daily-eligibility";
import { buildGlobalWeekdayWin, type GlobalWeekdayWinResult } from "./global-weekday-win";
import { buildProductionGlobalWeekdayWin } from "./global-universe";
import type { PlayedUniverseWeekday } from "./played-universe";

export type DailyTargetScheduleIssue = "result-date-boundary-unverified";

export type DailyLotteryTarget = {
  lotteryId: string;
  name: string;
  resultAt: string;
  closeAt: string | null;
  resultStartMinutes: number;
  historicalEvaluationEligible: boolean;
  scheduleIssues: DailyTargetScheduleIssue[];
};

export type DailyLockPlan = {
  deadlineBangkok: string | null;
  firstResultAt: string | null;
  exactDeadlineKnown: boolean;
  reason: "earliest-confirmed-close" | "before-first-result-only" | "no-target-schedule";
};

export type DailySourceMode = "locked" | "today_eligible";

export type DailyGlobalModeResult = {
  mode: DailySourceMode;
  result: GlobalWeekdayWinResult;
  configuredCount: number;
  eligibleCount: number;
  contributorIds: string[];
  eligibility: GlobalDailyEligibility[];
};

function startMinutes(value: string) {
  const match = value.match(/^(\d{2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/**
 * A target is defined only by an explicit Bangkok schedule. Results between
 * 00:00-04:59 remain valid Bangkok-day targets, but are excluded from historical
 * outcome matching until their provider draw-date convention is verified.
 */
export function resolveDailyLotteryTargets(catalog: LotteryDefinition[], weekday: PlayedUniverseWeekday): DailyLotteryTarget[] {
  return catalog.flatMap((lottery) => {
    const schedule = LIVE_RESULT_SOURCES[lottery.id];
    if (lottery.isActive === false || !schedule || !isLiveResultDay(schedule, weekday)) return [];
    const minutes = startMinutes(schedule.resultAt);
    if (minutes === null) return [];
    const crossesDateBoundary = minutes < 5 * 60;
    return [{
      lotteryId: lottery.id,
      name: lottery.name,
      resultAt: schedule.resultAt,
      closeAt: schedule.closeAt ?? null,
      resultStartMinutes: minutes,
      historicalEvaluationEligible: !crossesDateBoundary,
      scheduleIssues: crossesDateBoundary ? ["result-date-boundary-unverified" as const] : [],
    }];
  }).sort((left, right) => left.resultStartMinutes - right.resultStartMinutes || left.name.localeCompare(right.name, "th"));
}

export function resolveDailyLockPlan(targetDate: string, targets: DailyLotteryTarget[]): DailyLockPlan {
  if (!targets.length) return { deadlineBangkok: null, firstResultAt: null, exactDeadlineKnown: false, reason: "no-target-schedule" };
  const firstMinutes = Math.min(...targets.map((target) => target.resultStartMinutes)),
    firstTargets = targets.filter((target) => target.resultStartMinutes === firstMinutes),
    closeMinutes = firstTargets.map((target) => target.closeAt ? startMinutes(target.closeAt) : null);
  if (closeMinutes.every((value): value is number => value !== null)) {
    const deadlineMinutes = Math.min(...closeMinutes),
      dayOffset = deadlineMinutes > firstMinutes ? -1 : 0,
      date = new Date(`${targetDate}T12:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + dayOffset);
    return {
      deadlineBangkok: `${date.toISOString().slice(0, 10)}T${String(Math.floor(deadlineMinutes / 60)).padStart(2, "0")}:${String(deadlineMinutes % 60).padStart(2, "0")}:00+07:00`,
      firstResultAt: firstTargets[0].resultAt,
      exactDeadlineKnown: true,
      reason: "earliest-confirmed-close",
    };
  }
  return { deadlineBangkok: null, firstResultAt: firstTargets[0].resultAt, exactDeadlineKnown: false, reason: "before-first-result-only" };
}

export function buildDailyGlobalComparison(input: {
  catalog: LotteryDefinition[];
  snapshots: Record<string, Snapshot>;
  targetDate: string;
  weekday: PlayedUniverseWeekday;
  historical?: boolean;
  audit?: Record<string, { status: "supported" | "partial" | "failed" }>;
}) {
  const targets = resolveDailyLotteryTargets(input.catalog, input.weekday),
    targetIds = new Set(targets.map((target) => target.lotteryId)),
    historicallyVerifiedIds = new Set(targets.filter((target) => target.historicalEvaluationEligible).map((target) => target.lotteryId)),
    targetCatalog = input.catalog.filter((lottery) => targetIds.has(lottery.id)),
    verifiedTargetCatalog = targetCatalog.filter((lottery) => historicallyVerifiedIds.has(lottery.id)),
    locked = buildProductionGlobalWeekdayWin(input),
    todayResolved = resolveGlobalDailySources({
      catalog: verifiedTargetCatalog,
      snapshots: input.snapshots,
      targetDate: input.targetDate,
      weekday: input.weekday,
      historical: input.historical,
      audit: input.audit,
    }),
    todayResult = buildGlobalWeekdayWin(todayResolved.sources, { weekday: input.weekday, cutoffDate: input.targetDate });
  const mode = (value: DailyGlobalModeResult) => value;
  return {
    targetDate: input.targetDate,
    weekday: input.weekday,
    targets,
    targetCount: targets.length,
    historicalTargetCount: historicallyVerifiedIds.size,
    scheduleLimitations: targets.filter((target) => target.scheduleIssues.length),
    lockPlan: resolveDailyLockPlan(input.targetDate, targets),
    modes: {
      locked: mode({
        mode: "locked",
        result: locked.result,
        configuredCount: locked.universe.configuredCount,
        eligibleCount: locked.universe.eligibleCount,
        contributorIds: locked.universe.sources.map((source) => source.lotteryId),
        eligibility: locked.universe.eligibility,
      }),
      today_eligible: mode({
        mode: "today_eligible",
        result: todayResult,
        configuredCount: verifiedTargetCatalog.length,
        eligibleCount: todayResolved.sources.length,
        contributorIds: todayResolved.sources.map((source) => source.lotteryId),
        eligibility: todayResolved.eligibility,
      }),
    },
    targetSourceExclusions: todayResolved.eligibility.filter((item) => !item.eligible),
    targetSourceExclusionReasons: exclusionReasonCounts(todayResolved.eligibility),
  };
}

export function targetOutcomePopulation(
  comparison: ReturnType<typeof buildDailyGlobalComparison>,
  snapshots: Record<string, Snapshot>,
) {
  const targets = comparison.targets.filter((target) => target.historicalEvaluationEligible);
  return {
    scheduled: targets.length,
    available: targets.flatMap((target) =>
      (snapshots[target.lotteryId]?.draws ?? [])
        .filter((draw) => draw.drawDate === comparison.targetDate && draw.top2 && draw.bottom2)
        .map((draw) => ({ lotteryId: target.lotteryId, top2: draw.top2!, bottom2: draw.bottom2! })),
    ),
  };
}
