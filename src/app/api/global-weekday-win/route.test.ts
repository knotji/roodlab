import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createLock=vi.fn(),readLock=vi.fn().mockResolvedValue(null),digits=(values:string[])=>({sufficient:true,rankedDigits:values.map((digit,index)=>({digit,score:10-index})),digits:values.slice(0,6).map((digit,index)=>({digit,score:10-index}))});
vi.mock("@/lib/analysis/day-pattern",()=>({currentBangkokDateKey:()=>"2099-01-01",currentBangkokWeekday:()=>1}));
vi.mock("@/lib/cache",()=>({readCatalog:async()=>[],readAllSnapshots:async()=>({}),readCatalogAudit:async()=>({})}));
vi.mock("@/lib/database",()=>({hasDatabase:()=>true}));
vi.mock("@/lib/analysis/daily-global-targets",()=>({buildDailyGlobalComparison:()=>({targets:[],targetCount:0,historicalTargetCount:0,scheduleLimitations:[],targetSourceExclusions:[],lockPlan:{deadlineBangkok:"2099-01-01T05:40:00+07:00",firstResultAt:"05:45",exactDeadlineKnown:true,reason:"earliest-confirmed-close"},modes:{locked:{mode:"locked",result:digits(["0","1","2","3","4","5","6"]),configuredCount:1,eligibleCount:1,contributorIds:["a"],eligibility:[]},today_eligible:{mode:"today_eligible",result:digits(["9","8","7","6","5","4","3"]),configuredCount:1,eligibleCount:1,contributorIds:["b"],eligibility:[]}}})}));
vi.mock("@/lib/daily-global-lock",async(importOriginal)=>{const actual=await importOriginal<typeof import("@/lib/daily-global-lock")>();return{...actual,readDailyGlobalLock:readLock,createDailyGlobalLock:createLock}});
vi.mock("@/lib/prelock-sync-storage",()=>({readLatestPrelockSyncRun:async()=>({status:"ready",sourceIds:[]})}));
vi.mock("@/lib/prelock-sync",()=>({buildPrelockSyncPlan:()=>({sourceIds:[]})}));

describe("daily lock route authorization",()=>{
  beforeEach(()=>{process.env.DAILY_LOCK_SECRET="route-secret";createLock.mockResolvedValue({created:true,record:{id:"record"}});readLock.mockResolvedValue(null)});
  afterEach(()=>{delete process.env.DAILY_LOCK_SECRET;vi.clearAllMocks()});
  it("rejects a user without lock authorization",async()=>{const{POST}=await import("./route");const response=await POST(new Request("http://localhost/api/global-weekday-win",{method:"POST",headers:{"content-type":"application/json"},body:"{}"}));expect(response.status).toBe(401);expect(createLock).not.toHaveBeenCalled()});
  it("allows an authorized user through the API after validating the signed preview",async()=>{const lock=await import("@/lib/daily-global-lock"),comparison=((await import("@/lib/analysis/daily-global-targets")).buildDailyGlobalComparison as unknown as ()=>ReturnType<typeof import("@/lib/analysis/daily-global-targets")["buildDailyGlobalComparison"]>)(),preview=lock.pairedPreview({targetDate:"2099-01-01",weekday:1,plan:comparison.lockPlan,targets:comparison.targets,a:comparison.modes.locked,b:comparison.modes.today_eligible,versions:{}}),fingerprint=lock.previewFingerprint(preview),signature=lock.signPreview(fingerprint),{POST}=await import("./route"),response=await POST(new Request("http://localhost/api/global-weekday-win",{method:"POST",headers:{"content-type":"application/json","x-daily-lock-secret":"route-secret"},body:JSON.stringify({previewFingerprint:fingerprint,previewSignature:signature})}));expect(response.status).toBe(200);expect(createLock).toHaveBeenCalledOnce();expect(await response.json()).toMatchObject({ok:true,created:true})});
});
