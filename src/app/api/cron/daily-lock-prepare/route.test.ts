import { beforeEach, describe, expect, it, vi } from "vitest";

const execute=vi.fn(),latest=vi.fn();
vi.mock("@/lib/analysis/day-pattern",async(importOriginal)=>{const actual=await importOriginal<typeof import("@/lib/analysis/day-pattern")>();return{...actual,currentBangkokDateKey:()=>"2098-12-31"}});
vi.mock("@/lib/database",()=>({hasDatabase:()=>true}));
vi.mock("@/lib/cache",()=>({readCatalog:async()=>[],readAllSnapshots:async()=>({}),readCatalogAudit:async()=>({})}));
vi.mock("@/lib/prelock-sync",()=>({buildPrelockSyncPlan:()=>({targetDate:"2099-01-01",weekday:4,deadlineBangkok:"2099-01-01T05:40:00+07:00",exactDeadlineKnown:true,aSourceIds:[],bSourceIds:[],sourceIds:[],batches:[],scheduleLimitations:[]}),executePrelockSync:execute}));
vi.mock("@/lib/prelock-sync-storage",()=>({postgresPrelockSyncRunStore:{},readLatestPrelockSyncRun:latest}));
vi.mock("@/lib/sync-service",()=>({syncLotteryFromSource:vi.fn()}));

describe("daily lock preparation route",()=>{
  beforeEach(()=>{vi.clearAllMocks();process.env.CRON_SECRET="cron-test-secret";execute.mockResolvedValue({run:{status:"ready"},finalItems:[]});latest.mockResolvedValue(null)});
  it("rejects an unauthorized caller before storage or sync",async()=>{const{POST}=await import("./route");const response=await POST(new Request("http://localhost/api/cron/daily-lock-prepare",{method:"POST",body:"{}"}));expect(response.status).toBe(401);expect(execute).not.toHaveBeenCalled()});
  it("accepts an authorized test invocation for an allowed target date",async()=>{const{POST}=await import("./route");const response=await POST(new Request("http://localhost/api/cron/daily-lock-prepare",{method:"POST",headers:{authorization:"Bearer cron-test-secret","content-type":"application/json"},body:JSON.stringify({targetDate:"2099-01-01"})}));expect(response.status).toBe(200);expect(execute).toHaveBeenCalledOnce()});
  it("runs tomorrow preparation when Vercel invokes the cron with GET",async()=>{const{GET}=await import("./route");const response=await GET(new Request("http://localhost/api/cron/daily-lock-prepare",{headers:{authorization:"Bearer cron-test-secret"}}));expect(response.status).toBe(200);expect(execute).toHaveBeenCalledOnce()});
  it("keeps authenticated status inspection read-only",async()=>{const{GET}=await import("./route");const response=await GET(new Request("http://localhost/api/cron/daily-lock-prepare?status=1&date=2099-01-01",{headers:{authorization:"Bearer cron-test-secret"}}));expect(response.status).toBe(200);expect(latest).toHaveBeenCalledWith("2099-01-01");expect(execute).not.toHaveBeenCalled()});
});
