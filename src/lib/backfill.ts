import type { LotteryDefinition } from "./types";

export type BackfillAuditStatus = "supported" | "partial" | "failed";
export type BackfillPlanItem = { id: string; name: string; status: Exclude<BackfillAuditStatus, "failed">; reason: "missing" | "force" };

export function buildBackfillPlan(input: {
  catalog: LotteryDefinition[];
  audit: Record<string, { status: BackfillAuditStatus }>;
  hydratedIds: Iterable<string>;
  checkpointIds?: Iterable<string>;
  force?: boolean;
  limit?: number;
}) {
  const hydrated = new Set(input.hydratedIds), checkpoint = new Set(input.checkpointIds ?? []), force = input.force ?? false,
    eligible = input.catalog.filter((item) => item.isActive !== false && input.audit[item.id]?.status !== "failed"),
    skippedFailed = input.catalog.filter((item) => input.audit[item.id]?.status === "failed").length,
    items = eligible.filter((item) => !checkpoint.has(item.id) && (force || !hydrated.has(item.id))).map((item) => ({
      id: item.id,
      name: item.name,
      status: (input.audit[item.id]?.status ?? "partial") as "supported" | "partial",
      reason: (force ? "force" : "missing") as "force" | "missing",
    })).sort((a, b) => a.id.localeCompare(b.id));
  return {
    items: input.limit === undefined ? items : items.slice(0, Math.max(0, input.limit)),
    eligibleCount: eligible.length,
    hydratedCount: eligible.filter((item) => hydrated.has(item.id)).length,
    checkpointCount: eligible.filter((item) => checkpoint.has(item.id)).length,
    skippedFailed,
  };
}

export function parseBackfillNumber(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}
