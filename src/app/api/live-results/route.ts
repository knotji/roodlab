import { readAllSnapshots, readCatalog } from "@/lib/cache";
import { buildLiveBoard, nearDueIds } from "@/lib/live-board";
import { syncLotteryFromSource } from "@/lib/sync-service";
import { guardWrite } from "@/lib/write-guard";

async function payload() { const [catalog,snapshots]=await Promise.all([readCatalog(),readAllSnapshots()]), items=buildLiveBoard(catalog,snapshots); return { date:new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok"}).format(new Date()), updatedAt:new Date().toISOString(), scheduled:items.filter((item)=>item.resultAt).length, total:items.length, items }; }
export async function GET(){try{return Response.json({ok:true,...await payload()})}catch(error){return Response.json({ok:false,error:error instanceof Error?error.message:"อ่านผลสดไม่สำเร็จ"},{status:503})}}
export async function POST(request:Request){const guard=await guardWrite(request,"live-results",45);if(!guard.ok)return Response.json({ok:false,error:guard.error},{status:guard.status});try{const before=await payload(), ids=nearDueIds(before.items), results=await Promise.all(ids.map(async(id)=>{try{const result=await syncLotteryFromSource(id);return{id,ok:true,addedDraws:result.addedDraws}}catch(error){return{id,ok:false,error:error instanceof Error?error.message:"sync failed"}}}));return Response.json({ok:true,synced:ids.length,results,...await payload()})}catch(error){return Response.json({ok:false,error:error instanceof Error?error.message:"ตรวจผลล่าสุดไม่สำเร็จ"},{status:502})}}
