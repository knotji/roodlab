import { describe, expect, it } from "vitest";
import { GLOBAL_DAILY_SOURCE_IDS, curatedGlobalSources, isGlobalDailySource } from "./global-daily-sources";

describe("global daily source set", () => {
  it("contains the restored Dow Jones sources and the three requested Laos lotteries", () => {
    expect(GLOBAL_DAILY_SOURCE_IDS).toHaveLength(46);
    expect(new Set(GLOBAL_DAILY_SOURCE_IDS).size).toBe(46);
    expect(["laocitizen", "laosantipap", "laopatuxay"].every(isGlobalDailySource)).toBe(true);
    expect(["set", "gdaxi", "moexbc", "ftse100"].every(isGlobalDailySource)).toBe(true);
    expect(["dowjones-vip", "dowjonestar", "dji"].every(isGlobalDailySource)).toBe(true);
  });
  it("filters without changing source order", () => {
    expect(curatedGlobalSources([{ lotteryId:"other" }, { lotteryId:"laotv" }, { lotteryId:"dji" }]).map((item) => item.lotteryId)).toEqual(["laotv", "dji"]);
  });
});
