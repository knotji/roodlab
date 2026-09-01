import { describe, expect, it } from "vitest";
import { buildLiveBoard, nearDueIds, resultStartMinutes } from "./live-board";
import type { Snapshot } from "./cache";

const catalog=[{id:"laotv",name:"ลาวทีวี",slug:"laotv",category:"ลาว",sourceUrl:"https://example.com"}], snapshot=(date:string):Snapshot=>({lotteryId:"laotv",syncedAt:"2026-09-01T03:31:00Z",lastSuccessfulSyncAt:"2026-09-01T03:31:00Z",source:"AllHuay",draws:[{id:"x",lotteryId:"laotv",drawDate:date,top3:"123",top2:"23",bottom2:"45"}],historyVersion:"v",drawCount:1,latestCompleteDrawDate:date});
describe("live board",()=>{
  it("parses fixed and ranged result times",()=>{expect(resultStartMinutes("21:45–21:50")).toBe(1305);expect(resultStartMinutes(undefined)).toBeNull()});
  it("prefers today's canonical outcome over clock status",()=>{const items=buildLiveBoard(catalog,{laotv:snapshot("2026-09-01")},new Date("2026-09-01T04:00:00Z"));expect(items[0]).toMatchObject({status:"resulted",top3:"123",bottom2:"45"})});
  it("selects only near-due unresolved lotteries",()=>{const items=buildLiveBoard(catalog,{},new Date("2026-09-01T03:25:00Z"));expect(items[0].status).toBe("upcoming");expect(nearDueIds(items,new Date("2026-09-01T03:25:00Z"))).toEqual(["laotv"])});
});
