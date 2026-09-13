import { describe, expect, it, vi } from "vitest";
import { buildPrelockSyncPlan, executePrelockSync, type PrelockSyncPlan, type PrelockSyncRunStore } from "./prelock-sync";
import type { Snapshot } from "./cache";
import type { LotteryDefinition, LotteryDraw } from "./types";

const draw = (lotteryId:string,drawDate:string):LotteryDraw=>({id:`${lotteryId}-${drawDate}`,lotteryId,drawDate,top3:"123",top2:"23",bottom2:"45",source:"historical-table"});
const snapshot=(lotteryId:string):Snapshot=>({lotteryId,syncedAt:"2026-09-12T00:00:00Z",source:"AllHuay",draws:[draw(lotteryId,"2026-09-06")]});
const lottery=(id:string):LotteryDefinition=>({id,name:id,slug:id,category:"test",isActive:true,sourceUrl:`https://example.test/${id}`,capabilities:{top2:true,top3:true,bottom2:true}});

describe("pre-lock sync planning",()=>{
  it("syncs the deterministic union of configured A and date-verifiable B candidates",()=>{
    const catalog=[lottery("dji"),lottery("laopatuxay"),lottery("laotv")],snapshots=Object.fromEntries(catalog.map(x=>[x.id,snapshot(x.id)]));
    const plan=buildPrelockSyncPlan({catalog,snapshots,targetDate:"2026-09-13",weekday:0,batchSize:2});
    expect(plan.aSourceIds).toEqual(["dji"]);
    expect(plan.bSourceIds).toEqual(["laopatuxay","laotv"]);
    expect(plan.sourceIds).toEqual(["dji","laopatuxay","laotv"]);
    expect(plan.batches).toEqual([["dji","laopatuxay"],["laotv"]]);
  });
});

function plan(deadlineBangkok="2099-01-01T05:40:00+07:00"):PrelockSyncPlan{return{targetDate:"2099-01-01",weekday:4,deadlineBangkok,exactDeadlineKnown:true,aSourceIds:["a","b"],bSourceIds:["b","c"],sourceIds:["a","b","c"],batches:[["a","b"],["c"]],scheduleLimitations:[]}}
function store(){const created:unknown[]=[],attempts:unknown[]=[],finished:unknown[]=[];const value:PrelockSyncRunStore={create:async x=>{created.push(x)},recordAttempt:async x=>{attempts.push(x)},finish:async x=>{finished.push(x)}};return{value,created,attempts,finished}}

describe("pre-lock sync execution",()=>{
  it("retries per source, logs every attempt, and fails readiness when one source exhausts retries",async()=>{
    const previous=process.env.CRON_SECRET;process.env.CRON_SECRET="cron-secret-canary";
    try {
      const log=store(),calls=new Map<string,number>(),syncOne=vi.fn(async(id:string)=>{const count=(calls.get(id)??0)+1;calls.set(id,count);if(id==="b"&&count===1)throw new Error("temporary");if(id==="c")throw new TypeError("postgresql://user:password@example.test/db cron-secret-canary");return{outcome:"unchanged",addedDraws:0,snapshot:snapshot(id),freshness:{status:"up-to-date"}}});
      const result=await executePrelockSync({plan:plan(),store:log.value,syncOne,evaluateReadiness:async()=>({ready:true}),now:()=>new Date("2026-01-01T00:00:00Z")});
      expect(result.run).toMatchObject({status:"failed",successCount:2,failedCount:1});
      expect(log.attempts).toHaveLength(6);
      expect(log.finished).toHaveLength(1);
      expect(JSON.stringify(log.attempts)).not.toMatch(/password|cron-secret-canary|DATABASE_URL/);
    } finally { if(previous===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=previous; }
  });

  it("marks a complete pre-deadline A and B run ready",async()=>{
    const log=store(),result=await executePrelockSync({plan:plan(),store:log.value,syncOne:async(id)=>({outcome:"unchanged",addedDraws:0,snapshot:snapshot(id),freshness:{status:"up-to-date"}}),evaluateReadiness:async()=>({ready:true,a:{sufficient:true},b:{sufficient:true}}),now:()=>new Date("2026-01-01T00:00:00Z")});
    expect(result.run).toMatchObject({status:"ready",successCount:3,failedCount:0});
  });

  it("does not report ready after the server deadline",async()=>{
    const log=store(),result=await executePrelockSync({plan:plan("2025-01-01T00:00:00Z"),store:log.value,syncOne:async(id)=>({outcome:"unchanged",addedDraws:0,snapshot:snapshot(id),freshness:{status:"up-to-date"}}),evaluateReadiness:async()=>({ready:true}),now:()=>new Date("2026-01-01T00:00:00Z")});
    expect(result.run.status).toBe("failed");
    expect(result.run.readiness).toMatchObject({deadlinePassed:true});
  });
});
