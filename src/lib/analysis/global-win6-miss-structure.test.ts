import { describe, expect, it } from "vitest";
import { GLOBAL_WEEKDAY_LOOKBACK } from "./global-weekday-win";
import { buildOutsideOpportunities, classifyOutcomeMiss, classifySideMiss, outsidePositionPair, outsideRanking } from "./global-win6-miss-structure";

const ranking = ["0","1","2","3","4","5","6","7","8","9"].map((digit, index) => ({ digit, score: 1-index/10, topRate: .2, bottomRate: .2 }));
const selected = ranking.slice(0,6).map((item)=>item.digit);

describe("Global Win 6 miss structure",()=>{
  it("classifies full, one-outside, and two-outside sides",()=>{
    expect(classifySideMiss(selected,"05",ranking)).toMatchObject({classification:"FULL_COVERAGE",outsideDigits:[]});
    expect(classifySideMiss(selected,"06",ranking)).toMatchObject({classification:"ONE_OUTSIDE_DIGIT",outsideDigits:["6"]});
    expect(classifySideMiss(selected,"67",ranking)).toMatchObject({classification:"TWO_OUTSIDE_DIGITS",outsideDigits:["6","7"]});
  });
  it("counts an outside double once and an inside double as full coverage",()=>{
    expect(classifySideMiss(selected,"66",ranking)).toMatchObject({classification:"ONE_OUTSIDE_DIGIT",outsideDigits:["6"],outsideRanks:[7],outsidePositions:[1]});
    expect(classifySideMiss(selected,"00",ranking).classification).toBe("FULL_COVERAGE");
  });
  it("preserves leading-zero digit classification",()=>{
    expect(classifySideMiss(["1","2","3","4","5","6"],"07",ranking).outsideDigits).toEqual(["0","7"]);
  });
  it("maps global ranks 7-10 to outside positions 1-4 deterministically",()=>{
    expect(outsideRanking(ranking).map((item)=>[item.digit,item.globalRank,item.outsidePosition])).toEqual([["6",7,1],["7",8,2],["8",9,3],["9",10,4]]);
    expect(outsidePositionPair(classifySideMiss(selected,"97",ranking))).toBe("2+4");
  });
  it("counts four conditional opportunities per side and keeps top/bottom expectations separate",()=>{
    const scored=ranking.map((item,index)=>({...item,topRate:index/10,bottomRate:(10-index)/10})),top=buildOutsideOpportunities(scored,"67","top"),bottom=buildOutsideOpportunities(scored,"89","bottom");
    expect(top).toHaveLength(4);
    expect(top.filter((item)=>item.appeared).map((item)=>item.digit)).toEqual(["6","7"]);
    expect(bottom.filter((item)=>item.appeared).map((item)=>item.digit)).toEqual(["8","9"]);
    expect(top[0].expected).toBe(.6);
    expect(bottom[0].expected).toBe(.4);
  });
  it("classifies outcome coverage and unique outside digits across sides",()=>{
    const top=classifySideMiss(selected,"06",ranking),bottom=classifySideMiss(selected,"66",ranking);
    expect(classifyOutcomeMiss(top,bottom)).toEqual({coverage:"neitherFull",outsideDigits:["6"],outsideCount:1});
  });
  it("keeps the frozen production history window unchanged",()=>expect(GLOBAL_WEEKDAY_LOOKBACK).toBe(12));
});
