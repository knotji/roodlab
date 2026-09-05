import { describe, expect, it } from "vitest";
import { computeHistoryVersion, type Snapshot } from "../cache";
import type { LotteryDefinition, LotteryDraw } from "../types";
import {
  buildGlobalWeekdayWinForUniverse,
  buildProductionGlobalWeekdayWin,
  LEGACY_GLOBAL_46_SOURCE_IDS,
  resolveProductionGlobalUniverse,
  resolvePlayedUniverseTargets,
  resolveUniverseCatalog,
} from "./global-universe";
import { buildGlobalWeekdayWin } from "./global-weekday-win";
import { resolveGlobalDailySources } from "./global-daily-eligibility";
import { GLOBAL_DAILY_SOURCE_IDS } from "./global-daily-sources";
import { resolvePlayedUniverseSourceIds } from "./played-universe";

const definition = (id: string): LotteryDefinition => ({ id, slug: id, name: `Lottery ${id}`, category: "test", sourceUrl: `https://example.com/${id}`, isActive: true });
const draw = (lotteryId: string, drawDate: string, top2 = "11", bottom2 = "22"): LotteryDraw => ({ id: `${lotteryId}-${drawDate}`, lotteryId, drawDate, top3: `0${top2}`, top2, bottom2, completeness: "complete" });
const snapshot = (lotteryId: string, draws: LotteryDraw[], providerResultStatus: Snapshot["providerResultStatus"] = undefined): Snapshot => ({ lotteryId, draws, source: "AllHuay", syncedAt: "2026-09-04T00:00:00.000Z", lastSuccessfulSyncAt: "2026-09-04T00:00:00.000Z", historyVersion: computeHistoryVersion(lotteryId, draws), drawCount: draws.length, latestCompleteDrawDate: draws[0]?.drawDate ?? null, ...(providerResultStatus ? { providerResultStatus } : {}) });

const SATURDAY = 6 as const, targetDate = "2026-09-05"; // Saturday

describe("global universe source resolution", () => {
  it("all_eligible is a pure passthrough of the canonical catalog, unchanged from production", () => {
    const catalog = [definition("a"), definition("b")];
    expect(resolveUniverseCatalog(catalog, "all_eligible", SATURDAY)).toBe(catalog);
  });

  it("legacy_46 intersects the catalog with the frozen 46-source list and ignores unknown ids gracefully", () => {
    const catalog = [definition("dji"), definition("not-in-legacy-46"), definition("laotv")],
      filtered = resolveUniverseCatalog(catalog, "legacy_46", SATURDAY);
    expect(filtered.map((item) => item.id).sort()).toEqual(["dji", "laotv"]);
    expect(LEGACY_GLOBAL_46_SOURCE_IDS).toEqual(GLOBAL_DAILY_SOURCE_IDS);
  });

  it("played intersects the catalog with the resolved weekday list and returns nothing for a lottery outside it", () => {
    const catalog = [definition("dji"), definition("unrelated")],
      filtered = resolveUniverseCatalog(catalog, "played", SATURDAY);
    expect(filtered.map((item) => item.id)).toEqual(["dji"]);
  });

  it("played on a weekday with no operational list (Sunday) yields an empty universe rather than guessing", () => {
    const catalog = [definition("dji"), definition("laotv")],
      filtered = resolveUniverseCatalog(catalog, "played", 0);
    expect(filtered).toEqual([]);
    expect(resolvePlayedUniverseSourceIds(0)).toEqual([]);
  });

  it("handles a played-universe id that is not present in the canonical catalog without throwing", () => {
    const catalog = [definition("dji")]; // "hanoiasean" is played on Saturday but absent from this catalog
    expect(() => resolveUniverseCatalog(catalog, "played", SATURDAY)).not.toThrow();
    expect(resolveUniverseCatalog(catalog, "played", SATURDAY).map((item) => item.id)).toEqual(["dji"]);
  });
});

// "twse-vip" and "laoshd" are real Saturday played-universe ids (see played-universe.ts),
// used here to exercise eligibility exclusion without escaping the fixed weekday list.
describe("buildGlobalWeekdayWinForUniverse", () => {
  const catalog = [definition("dji"), definition("hanoiasean"), definition("twse-vip"), definition("laoshd")],
    snapshots: Record<string, Snapshot> = {
      dji: snapshot("dji", [draw("dji", "2026-08-29", "11", "22")]),
      hanoiasean: snapshot("hanoiasean", [draw("hanoiasean", "2026-08-29", "33", "44")]),
      "twse-vip": snapshot("twse-vip", [draw("twse-vip", "2026-08-29", "55", "66")], "suspended"),
      // "laoshd" intentionally has no snapshot entry -> missing-history
    };

  it("intersects the played universe with target-date eligibility (excludes suspended and history-less sources)", () => {
    const universe = buildGlobalWeekdayWinForUniverse({ mode: "played", catalog, snapshots, targetDate, weekday: SATURDAY });
    expect(universe.eligibility.map((item) => item.lotteryId).sort()).toEqual(["dji", "hanoiasean", "laoshd", "twse-vip"]);
    const suspended = universe.eligibility.find((item) => item.lotteryId === "twse-vip");
    expect(suspended?.reasons).toContain("provider-results-suspended");
    const noHistory = universe.eligibility.find((item) => item.lotteryId === "laoshd");
    expect(noHistory?.reasons).toContain("missing-history");
    expect(universe.eligibilitySummary.eligible).toBe(2); // only dji and hanoiasean clear eligibility
    expect(universe.result.lotteryCount).toBe(2);
  });

  it("reuses the exact same scoring engine as calling buildGlobalWeekdayWin directly (no duplicate/parallel scoring logic)", () => {
    const universe = buildGlobalWeekdayWinForUniverse({ mode: "played", catalog, snapshots, targetDate, weekday: SATURDAY }),
      manualCatalog = resolveUniverseCatalog(catalog, "played", SATURDAY),
      manualResolved = resolveGlobalDailySources({ catalog: manualCatalog, snapshots, targetDate, weekday: SATURDAY }),
      manualResult = buildGlobalWeekdayWin(manualResolved.sources, { weekday: SATURDAY, cutoffDate: targetDate });
    expect(universe.result).toEqual(manualResult);
  });

  it("never gives a source extra weight for being in the played universe (equal-source weighting unchanged)", () => {
    const saturdaysBefore = Array.from({ length: 12 }, (_, index) => {
        const date = new Date("2026-08-29T00:00:00.000Z");
        date.setUTCDate(date.getUTCDate() - 7 * index);
        return date.toISOString().slice(0, 10);
      }),
      heavy = saturdaysBefore.map((date) => draw("dji", date, "11", "11")),
      light = [draw("hanoiasean", "2026-08-29", "99", "99")],
      universe = buildGlobalWeekdayWinForUniverse({
        mode: "played",
        catalog: [definition("dji"), definition("hanoiasean")],
        snapshots: { dji: snapshot("dji", heavy), hanoiasean: snapshot("hanoiasean", light) },
        targetDate,
        weekday: 6,
      }),
      one = universe.result.digits.find((item) => item.digit === "1"),
      nine = universe.result.digits.find((item) => item.digit === "9");
    expect(one?.score).toBe(nine?.score);
  });

  it("excludes the target date itself and any future draw (no leakage)", () => {
    const leaking = snapshot("dji", [draw("dji", targetDate, "77", "77"), draw("dji", "2026-08-29", "11", "22")]),
      universe = buildGlobalWeekdayWinForUniverse({ mode: "played", catalog: [definition("dji")], snapshots: { dji: leaking }, targetDate, weekday: SATURDAY });
    expect(universe.result.digits.some((item) => item.digit === "7" && item.score > 0)).toBe(false);
  });

  it("is deterministic across repeated calls with identical input", () => {
    const first = buildGlobalWeekdayWinForUniverse({ mode: "played", catalog, snapshots, targetDate, weekday: SATURDAY }),
      second = buildGlobalWeekdayWinForUniverse({ mode: "played", catalog, snapshots, targetDate, weekday: SATURDAY });
    expect(first).toEqual(second);
  });

  it("all_eligible mode through this wrapper matches resolveGlobalDailySources on the untouched catalog (Production Global Win unchanged)", () => {
    const universe = buildGlobalWeekdayWinForUniverse({ mode: "all_eligible", catalog, snapshots, targetDate, weekday: SATURDAY }),
      production = resolveGlobalDailySources({ catalog, snapshots, targetDate, weekday: SATURDAY }),
      productionResult = buildGlobalWeekdayWin(production.sources, { weekday: SATURDAY, cutoffDate: targetDate });
    expect(universe.result).toEqual(productionResult);
  });
});

describe("resolvePlayedUniverseTargets", () => {
  it("takes no universe-mode parameter, so the graded outcome population is identical no matter which strategy is being scored", () => {
    const catalog = [definition("dji"), definition("hanoiasean"), definition("goverment")],
      snapshots: Record<string, Snapshot> = {
        dji: snapshot("dji", [draw("dji", targetDate, "11", "22")]),
        hanoiasean: snapshot("hanoiasean", [draw("hanoiasean", targetDate, "33", "44")]),
        goverment: snapshot("goverment", [draw("goverment", targetDate, "55", "66")]), // not in the Saturday played universe
      },
      targets = resolvePlayedUniverseTargets({ catalog, snapshots, weekday: SATURDAY, date: targetDate });
    expect(targets.map((item) => item.lotteryId).sort()).toEqual(["dji", "hanoiasean"]);
    expect(targets).toEqual(resolvePlayedUniverseTargets({ catalog, snapshots, weekday: SATURDAY, date: targetDate }));
  });

  it("excludes incomplete outcomes (missing top2 or bottom2) from the target population", () => {
    const catalog = [definition("dji")],
      snapshots: Record<string, Snapshot> = { dji: snapshot("dji", [{ ...draw("dji", targetDate), bottom2: undefined }]) };
    expect(resolvePlayedUniverseTargets({ catalog, snapshots, weekday: SATURDAY, date: targetDate })).toEqual([]);
  });
});

// Production migration: Monday-Saturday use the configured Played Universe, Sunday
// explicitly falls back to Dynamic All Eligible instead of resolving to zero sources.
const MONDAY = 1 as const, mondayDate = "2026-08-31", SUNDAY = 0 as const, sundayDate = "2026-08-30";

describe("resolveProductionGlobalUniverse", () => {
  const catalog = [definition("dji"), definition("hanoiasean"), definition("laotv"), definition("not-played-anywhere")],
    snapshots: Record<string, Snapshot> = {
      dji: snapshot("dji", [draw("dji", "2026-08-24", "11", "22")]),
      hanoiasean: snapshot("hanoiasean", [draw("hanoiasean", "2026-08-24", "33", "44")]),
      laotv: snapshot("laotv", [draw("laotv", "2026-08-24", "55", "66")]),
      "not-played-anywhere": snapshot("not-played-anywhere", [draw("not-played-anywhere", "2026-08-24", "77", "88")]),
    };

  it("resolves Monday to the configured Played Universe (mode = played)", () => {
    const universe = resolveProductionGlobalUniverse({ catalog, snapshots, targetDate: mondayDate, weekday: MONDAY });
    expect(universe.mode).toBe("played");
    expect(universe.configuredCount).toBe(3); // dji, hanoiasean, laotv are all in the Mon-Fri list; not-played-anywhere is excluded
    expect(universe.eligibleCount).toBe(3);
    expect(universe.sources.map((source) => source.lotteryId).sort()).toEqual(["dji", "hanoiasean", "laotv"]);
  });

  it("Sunday explicitly falls back to Dynamic All Eligible (mode = all_eligible_fallback), never an empty universe", () => {
    const sundaySnapshots: Record<string, Snapshot> = {
        dji: snapshot("dji", [draw("dji", "2026-08-23", "11", "22")]),
        hanoiasean: snapshot("hanoiasean", [draw("hanoiasean", "2026-08-23", "33", "44")]),
        laotv: snapshot("laotv", [draw("laotv", "2026-08-23", "55", "66")]),
        "not-played-anywhere": snapshot("not-played-anywhere", [draw("not-played-anywhere", "2026-08-23", "77", "88")]),
      },
      universe = resolveProductionGlobalUniverse({ catalog, snapshots: sundaySnapshots, targetDate: sundayDate, weekday: SUNDAY });
    expect(universe.mode).toBe("all_eligible_fallback");
    expect(universe.configuredCount).toBe(catalog.length); // whole catalog, not zero
    expect(universe.eligibleCount).toBe(catalog.length);
    expect(universe.sources.map((source) => source.lotteryId).sort()).toEqual(["dji", "hanoiasean", "laotv", "not-played-anywhere"]);
  });

  it("configured count and eligible-contributor count can differ once normal eligibility rules exclude sources", () => {
    const withGaps: Record<string, Snapshot> = { ...snapshots, laotv: snapshot("laotv", [draw("laotv", "2026-08-24", "55", "66")], "suspended") },
      universe = resolveProductionGlobalUniverse({ catalog, snapshots: withGaps, targetDate: mondayDate, weekday: MONDAY });
    expect(universe.configuredCount).toBe(3);
    expect(universe.eligibleCount).toBe(2); // laotv suspended, excluded by the existing (unmodified) eligibility rule
  });
});

describe("buildProductionGlobalWeekdayWin", () => {
  const catalog = [definition("dji"), definition("hanoiasean")],
    snapshots: Record<string, Snapshot> = {
      dji: snapshot("dji", [draw("dji", "2026-08-24", "11", "22")]),
      hanoiasean: snapshot("hanoiasean", [draw("hanoiasean", "2026-08-24", "33", "44")]),
    };

  it("Monday production Win 6 uses the exact same scoring engine as calling buildGlobalWeekdayWin directly on the same sources", () => {
    const universe = buildProductionGlobalWeekdayWin({ catalog, snapshots, targetDate: mondayDate, weekday: MONDAY }),
      manual = buildGlobalWeekdayWin(universe.universe.sources, { weekday: MONDAY, cutoffDate: mondayDate });
    expect(universe.result).toEqual(manual);
  });

  it("Sunday fallback Win 6 matches calling the unmodified resolveGlobalDailySources + buildGlobalWeekdayWin on the full catalog directly", () => {
    const sundaySnapshots: Record<string, Snapshot> = {
        dji: snapshot("dji", [draw("dji", "2026-08-23", "11", "22")]),
        hanoiasean: snapshot("hanoiasean", [draw("hanoiasean", "2026-08-23", "33", "44")]),
      },
      universe = buildProductionGlobalWeekdayWin({ catalog, snapshots: sundaySnapshots, targetDate: sundayDate, weekday: SUNDAY }),
      production = resolveGlobalDailySources({ catalog, snapshots: sundaySnapshots, targetDate: sundayDate, weekday: SUNDAY }),
      productionResult = buildGlobalWeekdayWin(production.sources, { weekday: SUNDAY, cutoffDate: sundayDate });
    expect(universe.result).toEqual(productionResult);
    expect(universe.result.lotteryCount).toBe(2); // meaningful, non-degenerate comparison
  });

  it("is deterministic", () => {
    const first = buildProductionGlobalWeekdayWin({ catalog, snapshots, targetDate: mondayDate, weekday: MONDAY }),
      second = buildProductionGlobalWeekdayWin({ catalog, snapshots, targetDate: mondayDate, weekday: MONDAY });
    expect(first).toEqual(second);
  });

  it("Gemini (which calls resolveProductionGlobalUniverse directly) and production (via buildProductionGlobalWeekdayWin) resolve the identical universe for the same target date - no conflicting source universes", () => {
    const viaProduction = buildProductionGlobalWeekdayWin({ catalog, snapshots, targetDate: mondayDate, weekday: MONDAY }).universe,
      viaGemini = resolveProductionGlobalUniverse({ catalog, snapshots, targetDate: mondayDate, weekday: MONDAY });
    expect(viaProduction).toEqual(viaGemini);
  });
});
