import { describe, expect, it } from "vitest";
import { GLOBAL_WEEKDAY_LOOKBACK } from "./global-weekday-win";
import { chronologicalSplit, digitPresence, marginalResidual, RANK_BANDS, RANK_SUMMARY_GROUPS, spearmanAssociation } from "./global-rank-gradient-audit";

describe("global production rank gradient helpers",()=>{
  it("maps all ten unique ranks into five fixed two-rank bands",()=>{
    expect(RANK_BANDS.flatMap((band)=>band.ranks)).toEqual([1,2,3,4,5,6,7,8,9,10]);
    expect(new Set(RANK_BANDS.flatMap((band)=>band.ranks)).size).toBe(10);
  });
  it("freezes high, middle, and low definitions",()=>{
    expect(RANK_SUMMARY_GROUPS).toEqual({high:[1,2],middle:[5,6],low:[9,10]});
  });
  it("counts leading zero and doubles once per side",()=>{
    expect(digitPresence("08","0")).toBe(true);
    expect(digitPresence("08","8")).toBe(true);
    expect(digitPresence("33","3")).toBe(true);
    expect(["3"].filter((digit)=>digitPresence("33",digit))).toHaveLength(1);
  });
  it("keeps top and bottom presence separate",()=>{
    expect(digitPresence("12","1")).toBe(true);
    expect(digitPresence("34","1")).toBe(false);
  });
  it("computes deterministic Spearman direction including ties",()=>{
    expect(spearmanAssociation([1,2,3,4],[4,3,2,1])).toBeCloseTo(-1);
    expect(spearmanAssociation([1,2,3,4],[1,1,0,0])).toBeLessThan(0);
  });
  it("uses the frozen chronological 75/25 split",()=>{
    const split=chronologicalSplit([1,2,3,4,5,6,7,8]);
    expect(split).toEqual({development:[1,2,3,4,5,6],holdout:[7,8]});
  });
  it("adjusts only against available prior digit identity history",()=>{
    expect(marginalResidual(1,6,10)).toBeCloseTo(.4);
    expect(marginalResidual(0,0,0)).toBeNull();
  });
  it("keeps production configuration unchanged",()=>expect(GLOBAL_WEEKDAY_LOOKBACK).toBe(12));
});
