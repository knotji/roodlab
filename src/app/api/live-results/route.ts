import { readCatalog, readSnapshots } from "@/lib/cache";
import { runBounded } from "@/lib/all-lottery-sync";
import { buildLiveBoard, nearDueIds } from "@/lib/live-board";
import { syncLotteryFromSource } from "@/lib/sync-service";
import { guardWrite } from "@/lib/write-guard";
import { LIVE_RESULT_SOURCES } from "@/lib/live-results";

const PAYLOAD_CACHE_MS = 20_000;
let cachedPayload: { expiresAt: number; value: Awaited<ReturnType<typeof buildPayload>> } | null = null;

async function buildPayload() {
  const catalog = await readCatalog(), liveIds = catalog.filter((item) => item.id in LIVE_RESULT_SOURCES).map((item) => item.id), snapshots = await readSnapshots(liveIds), items = buildLiveBoard(catalog, snapshots);
  return { date:new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok"}).format(new Date()), updatedAt:new Date().toISOString(), scheduled:items.length, total:items.length, items };
}
async function payload(force = false) {
  if (!force && cachedPayload && cachedPayload.expiresAt > Date.now()) return cachedPayload.value;
  const value = await buildPayload();
  cachedPayload = { expiresAt: Date.now() + PAYLOAD_CACHE_MS, value };
  return value;
}
export async function GET(){try{return Response.json({ok:true,...await payload()},{headers:{"Cache-Control":"public, s-maxage=20, stale-while-revalidate=40"}})}catch(error){return Response.json({ok:false,error:error instanceof Error?error.message:"อ่านผลสดไม่สำเร็จ"},{status:503})}}
export async function POST(request:Request){const guard=await guardWrite(request,"live-results",45);if(!guard.ok)return Response.json({ok:false,error:guard.error},{status:guard.status});try{const before=await payload(true), ids=nearDueIds(before.items), results=await runBounded(ids,3,async(id)=>{try{const result=await syncLotteryFromSource(id);return{id,ok:true,addedDraws:result.addedDraws}}catch(error){return{id,ok:false,error:error instanceof Error?error.message:"sync failed"}}});cachedPayload=null;return Response.json({ok:true,synced:ids.length,results,...await payload(true)})}catch(error){return Response.json({ok:false,error:error instanceof Error?error.message:"ตรวจผลล่าสุดไม่สำเร็จ"},{status:502})}}
