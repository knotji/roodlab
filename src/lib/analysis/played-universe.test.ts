import { describe, expect, it } from "vitest";
import lotteries from "../../../data/lotteries.json";
import {
  PLAYED_UNIVERSE_BY_WEEKDAY,
  UNRESOLVED_WEEKDAY_ALIASES,
  playedUniverseAliasesForWeekday,
  resolvePlayedUniverseSourceIds,
  type PlayedUniverseWeekday,
} from "./played-universe";

const canonicalIds = new Set((lotteries as { id: string }[]).map((lottery) => lottery.id));
const WEEKDAYS: readonly PlayedUniverseWeekday[] = [1, 2, 3, 4, 5];

describe("played universe weekday resolution", () => {
  it.each(WEEKDAYS)("weekday %i (Monday-Friday) resolves the shared operational list", (weekday) => {
    const resolved = resolvePlayedUniverseSourceIds(weekday);
    expect(resolved.length).toBe(37);
    expect(resolved).toContain("nikkei-vip-morning");
    expect(resolved).toContain("dji");
  });

  it("all five weekdays (Mon-Fri) resolve to the exact same canonical operational list", () => {
    const [monday, ...rest] = WEEKDAYS.map((weekday) => resolvePlayedUniverseSourceIds(weekday));
    for (const other of rest) expect(other).toEqual(monday);
  });

  it("Saturday still resolves exactly the existing accepted 25-source configured universe, unchanged by the Mon-Fri migration", () => {
    const saturday = resolvePlayedUniverseSourceIds(6);
    expect(saturday.length).toBe(25);
    expect(new Set(saturday).size).toBe(saturday.length);
    expect(saturday).not.toEqual(resolvePlayedUniverseSourceIds(1)); // distinct list, not accidentally shared with Mon-Fri
  });

  it("Sunday has no configured operational list - production must treat this as an explicit All Eligible fallback, not zero sources", () => {
    expect(resolvePlayedUniverseSourceIds(0)).toEqual([]);
  });

  it("every configured source id (Mon-Fri and Saturday) exists in the canonical catalog", () => {
    for (const weekday of [...WEEKDAYS, 6] as const) {
      for (const id of resolvePlayedUniverseSourceIds(weekday)) expect(canonicalIds.has(id)).toBe(true);
    }
  });

  it("configured source ids contain no duplicates for any weekday", () => {
    for (const weekday of [...WEEKDAYS, 6] as const) {
      const ids = resolvePlayedUniverseSourceIds(weekday);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("maps every Mon-Fri alias to a canonical catalog id (deterministic, no ambiguity)", () => {
    for (const alias of playedUniverseAliasesForWeekday(1)) {
      expect(canonicalIds.has(alias.id)).toBe(true);
    }
  });

  it("collapses duplicate/alternate-spelling aliases to one canonical id (e.g. bare 'ดาวโจนส์' vs 'ดาวโจนส์ STAR' stay distinct sources)", () => {
    const aliases = playedUniverseAliasesForWeekday(1),
      djiAlias = aliases.find((alias) => alias.name === "ดาวโจนส์"),
      starAlias = aliases.find((alias) => alias.name === "ดาวโจนส์ STAR");
    expect(djiAlias?.id).toBe("dji");
    expect(starAlias?.id).toBe("dowjonestar");
    expect(djiAlias?.id).not.toBe(starAlias?.id);
  });

  it("alias resolution is deterministic across repeated lookups", () => {
    expect(playedUniverseAliasesForWeekday(1)).toEqual(playedUniverseAliasesForWeekday(1));
    expect(resolvePlayedUniverseSourceIds(6)).toEqual(resolvePlayedUniverseSourceIds(6));
  });

  it("records genuinely unresolved Mon-Fri names instead of guessing a canonical id for them", () => {
    const unresolvedNames = UNRESOLVED_WEEKDAY_ALIASES.map((item) => item.name);
    expect(unresolvedNames).toEqual(expect.arrayContaining(["ปักกิ่งเช้า", "ปักกิ่งบ่าย", "อินโดนีเซีย", "ฮ่องกง VIP"]));
    const configuredIds = new Set(resolvePlayedUniverseSourceIds(1));
    for (const unresolved of UNRESOLVED_WEEKDAY_ALIASES) {
      // none of the unresolved names should have silently produced a membership entry
      expect(configuredIds.has(unresolved.name)).toBe(false);
    }
  });

  it("does not silently alias the ambiguous 'ฮ่องกง VIP' to hongkong-visa or hkindex-st (unconfirmed provider identity)", () => {
    const configuredIds = new Set(resolvePlayedUniverseSourceIds(1));
    expect(configuredIds.has("hongkong-visa")).toBe(false);
    expect(configuredIds.has("hkindex-st")).toBe(false);
  });

  it("is a frozen static config, not derived from result data", () => {
    expect(Object.keys(PLAYED_UNIVERSE_BY_WEEKDAY).sort()).toEqual(["0", "1", "2", "3", "4", "5", "6"]);
  });
});
