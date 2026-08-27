import type { LotteryDraw } from "./types";

export type FreshnessStatus =
  | "up-to-date"
  | "cache-behind"
  | "source-behind"
  | "source-unreachable"
  | "unknown";

export type FreshnessInfo = {
  currentDate: string;
  sourceLatestDrawDate: string | null;
  cachedLatestDrawDate: string | null;
  checkedAt: string;
  status: FreshnessStatus;
  currentSourceResultDate?: string | null;
};

const BANGKOK = "Asia/Bangkok";

export function bangkokCalendarDate(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

export function latestDrawDate(draws: LotteryDraw[]): string | null {
  if (!draws.length) return null;
  return draws.reduce(
    (max, draw) => (draw.drawDate > max ? draw.drawDate : max),
    draws[0].drawDate,
  );
}

export function computeFreshnessStatus(input: {
  sourceLatestDrawDate: string | null;
  cachedLatestDrawDate: string | null;
  sourceReachable: boolean;
}): FreshnessStatus {
  const { sourceLatestDrawDate, cachedLatestDrawDate, sourceReachable } = input;

  if (!sourceReachable) return "source-unreachable";
  if (!sourceLatestDrawDate && !cachedLatestDrawDate) return "unknown";
  if (!sourceLatestDrawDate) return cachedLatestDrawDate ? "unknown" : "unknown";
  if (!cachedLatestDrawDate) return "cache-behind";

  if (sourceLatestDrawDate > cachedLatestDrawDate) return "cache-behind";
  if (cachedLatestDrawDate > sourceLatestDrawDate) return "source-behind";
  return "up-to-date";
}

export function buildFreshnessInfo(input: {
  sourceLatestDrawDate: string | null;
  cachedLatestDrawDate: string | null;
  sourceReachable: boolean;
  checkedAt?: Date;
  currentSourceResultDate?: string | null;
}): FreshnessInfo {
  return {
    currentDate: bangkokCalendarDate(input.checkedAt),
    sourceLatestDrawDate: input.sourceLatestDrawDate,
    cachedLatestDrawDate: input.cachedLatestDrawDate,
    checkedAt: (input.checkedAt ?? new Date()).toISOString(),
    status: computeFreshnessStatus(input),
    ...(input.currentSourceResultDate !== undefined ? { currentSourceResultDate: input.currentSourceResultDate } : {}),
  };
}

export function mergeDrawHistory(
  existing: LotteryDraw[],
  incoming: LotteryDraw[],
  limit = 100,
): LotteryDraw[] {
  return Array.from(
    new Map(
      [...existing, ...incoming].map((draw) => [draw.id, draw] as const),
    ).values(),
  )
    .sort((a, b) => b.drawDate.localeCompare(a.drawDate))
    .slice(0, limit);
}

export function countNewDraws(
  before: LotteryDraw[],
  after: LotteryDraw[],
): number {
  const beforeIds = new Set(before.map((draw) => draw.id));
  return after.filter((draw) => !beforeIds.has(draw.id)).length;
}
