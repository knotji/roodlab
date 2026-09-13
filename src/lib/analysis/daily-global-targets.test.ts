import { describe, expect, it } from "vitest";
import { computeHistoryVersion, type Snapshot } from "../cache";
import type { LotteryDefinition, LotteryDraw } from "../types";
import { buildDailyGlobalComparison, resolveDailyLockPlan, resolveDailyLotteryTargets, targetOutcomePopulation } from "./daily-global-targets";

const definition = (id: string): LotteryDefinition => ({ id, slug: id, name: id, category: "test", sourceUrl: `https://example.com/${id}`, isActive: true });
const draw = (lotteryId: string, drawDate: string, top2 = "12", bottom2 = "34"): LotteryDraw => ({ id: `${lotteryId}-${drawDate}`, lotteryId, drawDate, top3: `0${top2}`, top2, bottom2, completeness: "complete" });
const snapshot = (lotteryId: string, draws: LotteryDraw[]): Snapshot => ({ lotteryId, draws, source: "AllHuay", syncedAt: "2026-09-11T00:00:00.000Z", historyVersion: computeHistoryVersion(lotteryId, draws) });

describe("daily target and source universes", () => {
  it("uses explicit Bangkok schedules and does not infer unscheduled lotteries", () => {
    const targets = resolveDailyLotteryTargets([definition("laotv"), definition("unknown")], 1);
    expect(targets.map((target) => target.lotteryId)).toEqual(["laotv"]);
  });

  it("flags after-midnight schedules instead of guessing provider draw-date alignment", () => {
    const targets = resolveDailyLotteryTargets([definition("dowjones-vip"), definition("laotv")], 1);
    expect(targets.find((target) => target.lotteryId === "dowjones-vip")).toMatchObject({
      historicalEvaluationEligible: false,
      scheduleIssues: ["result-date-boundary-unverified"],
    });
  });

  it("derives the lock deadline from the earliest target's confirmed close time", () => {
    const targets = resolveDailyLotteryTargets([definition("laotv"), definition("laopatuxay")], 1);
    expect(resolveDailyLockPlan("2026-09-14", targets)).toMatchObject({
      deadlineBangkok: "2026-09-14T05:40:00+07:00",
      firstResultAt: "05:45",
      exactDeadlineKnown: true,
    });
  });

  it("keeps target outcomes separate from source contributors and excludes the target date from scoring", () => {
    const mondays = ["2026-09-07", "2026-08-31", "2026-08-24", "2026-08-17"],
      snapshots = Object.fromEntries(["laotv", "xosohd"].map((id) => [id, snapshot(id, [draw(id, "2026-09-14", "99", "99"), ...mondays.map((date) => draw(id, date))])])),
      comparison = buildDailyGlobalComparison({ catalog: [definition("laotv"), definition("xosohd")], snapshots, targetDate: "2026-09-14", weekday: 1, historical: true });
    expect(comparison.targetCount).toBe(2);
    expect(comparison.modes.today_eligible.contributorIds).toEqual(["laotv", "xosohd"]);
    expect(comparison.modes.today_eligible.result.rankedDigits.find((item) => item.digit === "9")?.score).toBe(0);
    expect(targetOutcomePopulation(comparison, snapshots).available).toHaveLength(2);
  });

  it("reports scheduled targets with insufficient history instead of counting them as outcomes", () => {
    const snapshots = { laotv: snapshot("laotv", [draw("laotv", "2026-09-14")]) },
      comparison = buildDailyGlobalComparison({ catalog: [definition("laotv"), definition("xosohd")], snapshots, targetDate: "2026-09-14", weekday: 1, historical: true });
    expect(comparison.targetSourceExclusions.map((item) => item.lotteryId)).toEqual(["laotv", "xosohd"]);
    expect(targetOutcomePopulation(comparison, snapshots)).toMatchObject({ scheduled: 2, available: [{ lotteryId: "laotv" }] });
  });
});
