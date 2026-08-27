import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { LotteryDrawSchema, type LotteryDraw, type LotteryDefinition } from "./types";
import { isCompleteDraw } from "./data-sources/integrity";
import { computeHistoryVersion } from "./history-version";
export { computeHistoryVersion } from "./history-version";

const FreshnessSchema=z.object({currentDate:z.string(),sourceLatestDrawDate:z.string().nullable(),cachedLatestDrawDate:z.string().nullable(),checkedAt:z.string(),status:z.enum(["up-to-date","cache-behind","source-behind","source-unreachable","unknown"]),currentSourceResultDate:z.string().nullable().optional()});
const SyncOutcomeSchema=z.enum(["updated","unchanged","parse-failure","validation-failure","write-failure"]);
const CacheSchema=z.object({lotteryId:z.string(),syncedAt:z.string(),lastSuccessfulSyncAt:z.string().optional(),source:z.string(),draws:z.array(LotteryDrawSchema),historyVersion:z.string().optional(),drawCount:z.number().int().nonnegative().optional(),latestCompleteDrawDate:z.string().nullable().optional(),currentSourceResultDate:z.string().nullable().optional(),syncOutcome:SyncOutcomeSchema.optional(),freshness:FreshnessSchema.optional()});
export type Snapshot=z.infer<typeof CacheSchema>;
export type SnapshotFreshness=z.infer<typeof FreshnessSchema>;
export type SyncOutcome=z.infer<typeof SyncOutcomeSchema>;
const dataDir=path.join(process.cwd(),"data"),historyDir=path.join(dataDir,"history"),catalogFile=path.join(dataDir,"lotteries.json");
const safeId=(id:string)=>{if(!/^[a-z0-9-]+$/i.test(id))throw new Error("lottery id ไม่ถูกต้อง");return id};

export async function readCatalog():Promise<LotteryDefinition[]>{try{return JSON.parse(await fs.readFile(catalogFile,"utf8")) as LotteryDefinition[];}catch{return[];}}
export async function writeCatalog(catalog:LotteryDefinition[]){await fs.mkdir(dataDir,{recursive:true});await fs.writeFile(catalogFile,JSON.stringify(catalog,null,2),"utf8");return catalog;}
export async function readCatalogAudit():Promise<Record<string,{status:"supported"|"partial"|"failed";reason?:string}>>{try{const report=JSON.parse(await fs.readFile(path.join(dataDir,"catalog-audit.json"),"utf8")) as {items:{id:string;status:"supported"|"partial"|"failed";reason?:string}[]};return Object.fromEntries(report.items.map(x=>[x.id,{status:x.status,reason:x.reason}]))}catch{return{}}}
export async function readSnapshot(id:string):Promise<Snapshot|null>{try{const parsed=CacheSchema.parse(JSON.parse(await fs.readFile(path.join(historyDir,`${safeId(id)}.json`),"utf8")));return{...parsed,historyVersion:parsed.historyVersion??computeHistoryVersion(parsed.lotteryId,parsed.draws),drawCount:parsed.drawCount??parsed.draws.length,latestCompleteDrawDate:parsed.latestCompleteDrawDate??parsed.draws.find(isCompleteDraw)?.drawDate??null,lastSuccessfulSyncAt:parsed.lastSuccessfulSyncAt??parsed.syncedAt}}catch{return null}}
export async function readAllSnapshots():Promise<Record<string,Snapshot>>{const result:Record<string,Snapshot>={};try{for(const name of await fs.readdir(historyDir)){if(!name.endsWith(".json"))continue;const id=name.slice(0,-5),snapshot=await readSnapshot(id);if(snapshot)result[id]=snapshot}}catch{}return result}
export async function atomicWriteFile(target:string,contents:string){await fs.mkdir(path.dirname(target),{recursive:true});const temporary=path.join(path.dirname(target),`.${path.basename(target)}.${randomUUID()}.tmp`);let handle:Awaited<ReturnType<typeof fs.open>>|undefined;try{handle=await fs.open(temporary,"wx");await handle.writeFile(contents,"utf8");await handle.sync();await handle.close();handle=undefined;await fs.rename(temporary,target)}catch(error){await handle?.close().catch(()=>undefined);await fs.unlink(temporary).catch(()=>undefined);throw error}}
export async function writeSnapshot(lotteryId:string,draws:LotteryDraw[],freshness?:SnapshotFreshness,metadata?:{currentSourceResultDate?:string|null;syncOutcome?:SyncOutcome}):Promise<Snapshot>{const now=new Date().toISOString(),snapshot:Snapshot={lotteryId,syncedAt:now,lastSuccessfulSyncAt:now,source:"AllHuay",draws,historyVersion:computeHistoryVersion(lotteryId,draws),drawCount:draws.length,latestCompleteDrawDate:draws.find(isCompleteDraw)?.drawDate??null,currentSourceResultDate:metadata?.currentSourceResultDate??draws[0]?.drawDate??null,syncOutcome:metadata?.syncOutcome??"updated",...(freshness?{freshness}:{})};await atomicWriteFile(path.join(historyDir,`${safeId(lotteryId)}.json`),JSON.stringify(snapshot,null,2));return snapshot}
