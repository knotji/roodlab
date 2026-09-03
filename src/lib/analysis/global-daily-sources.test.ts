import { describe, expect, it } from "vitest";
import { GLOBAL_DAILY_SOURCE_IDS, curatedGlobalSources, isGlobalDailySource } from "./global-daily-sources";

describe("global daily source set", () => {
  it("contains 40 schedule sources plus the three requested Laos lotteries", () => {
    expect(GLOBAL_DAILY_SOURCE_IDS).toHaveLength(43);
    expect(new Set(GLOBAL_DAILY_SOURCE_IDS).size).toBe(43);
    expect(["laocitizen", "laosantipap", "laopatuxay"].every(isGlobalDailySource)).toBe(true);
    expect(["dowjones-vip", "dowjonestar", "dji"].some(isGlobalDailySource)).toBe(false);
  });
  it("filters without changing source order", () => {
    expect(curatedGlobalSources([{ lotteryId:"other" }, { lotteryId:"laotv" }, { lotteryId:"dji" }]).map((item) => item.lotteryId)).toEqual(["laotv"]);
  });
});
