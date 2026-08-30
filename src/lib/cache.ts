import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { LotteryDrawSchema, type LotteryDraw, type LotteryDefinition } from "./types";
import { isCompleteDraw } from "./data-sources/integrity";
import { computeHistoryVersion } from "./history-version";
import { hasDatabase } from "./database";
import { readAllPostgresSnapshots,readDocument,readPostgresSnapshot,writeDocument,writePostgresSnapshot } from "./postgres-storage";
export { computeHistoryVersion } from "./history-version";

const FreshnessSchema=z.object({currentDate:z.string(),sourceLatestDrawDate:z.string().nullable(),cachedLatestDrawDate:z.string().nullable(),checkedAt:z.string(),status:z.enum(["up-to-date","cache-behind","source-behind","source-unreachable","unknown"]),currentSourceResultDate:z.string().nullable().optional()});
const SyncOutcomeSchema=z.enum(["updated","unchanged","parse-failure","validation-failure","write-failure"]);
const CacheSchema=z.object({lotteryId:z.string(),syncedAt:z.string(),lastSuccessfulSyncAt:z.string().optional(),source:z.string(),draws:z.array(LotteryDrawSchema),historyVersion:z.string().optional(),drawCount:z.number().int().nonnegative().optional(),latestCompleteDrawDate:z.string().nullable().optional(),currentSourceResultDate:z.string().nullable().optional(),syncOutcome:SyncOutcomeSchema.optional(),freshness:FreshnessSchema.optional()});
export type Snapshot=z.infer<typeof CacheSchema>;
export type SnapshotFreshness=z.infer<typeof FreshnessSchema>;
export type SyncOutcome=z.infer<typeof SyncOutcomeSchema>;
const dataDir=path.join(process.cwd(),"data"),historyDir=path.join(dataDir,"history"),catalogFile=path.join(dataDir,"lotteries.json");
const safeId=(id:string)=>{if(!/^[a-z0-9-]+$/i.test(id))throw new Error("lottery id ไม่ถูกต้อง");return id};

const READ_TTL_MS=30_000;
type Timed<T>={value:T;expiresAt:number};
let catalogMemory:Timed<LotteryDefinition[]>|null=null;
let auditMemory:Timed<Record<string,{status:"supported"|"partial"|"failed";reason?:string}>>|null=null;
const snapshotMemory=new Map<string,Timed<Snapshot|null>>();
const fresh=<T>(entry:Timed<T>|null|undefined)=>entry&&entry.expiresAt>Date.now()?entry.value:undefined;
const timed=<T>(value:T):Timed<T>=>({value,expiresAt:Date.now()+READ_TTL_MS});

export async function readCatalog():Promise<LotteryDefinition[]>{const cached=fresh(catalogMemory);if(cached)return cached;let catalog:LotteryDefinition[]=[];if(hasDatabase()){try{const stored=await readDocument("catalog");if(stored)catalog=stored as LotteryDefinition[]}catch{}}if(!catalog.length)try{catalog=JSON.parse(await fs.readFile(catalogFile,"utf8")) as LotteryDefinition[]}catch{}catalogMemory=timed(catalog);return catalog}
export async function writeCatalog(catalog:LotteryDefinition[]){if(hasDatabase())await writeDocument("catalog",catalog);else{await fs.mkdir(dataDir,{recursive:true});await fs.writeFile(catalogFile,JSON.stringify(catalog,null,2),"utf8")}catalogMemory=timed(catalog);return catalog}
export async function readCatalogAudit():Promise<Record<string,{status:"supported"|"partial"|"failed";reason?:string}>>{const cached=fresh(auditMemory);if(cached)return cached;let report:unknown=null;if(hasDatabase()){try{report=await readDocument("catalog-audit")}catch{}}try{report??=JSON.parse(await fs.readFile(path.join(dataDir,"catalog-audit.json"),"utf8"));const parsed=report as {items:{id:string;status:"supported"|"partial"|"failed";reason?:string}[]},audit=Object.fromEntries(parsed.items.map(x=>[x.id,{status:x.status,reason:x.reason}]));auditMemory=timed(audit);return audit}catch{return{}}}
export async function writeCatalogAudit(report:unknown){if(hasDatabase())await writeDocument("catalog-audit",report);else await atomicWriteFile(path.join(dataDir,"catalog-audit.json"),JSON.stringify(report,null,2));auditMemory=null;return report}
export function normalizeSnapshot(value:unknown):Snapshot{const parsed=CacheSchema.parse(value);return{...parsed,historyVersion:parsed.historyVersion??computeHistoryVersion(parsed.lotteryId,parsed.draws),drawCount:parsed.drawCount??parsed.draws.length,latestCompleteDrawDate:parsed.latestCompleteDrawDate??parsed.draws.find(isCompleteDraw)?.drawDate??null,lastSuccessfulSyncAt:parsed.lastSuccessfulSyncAt??parsed.syncedAt}}
export async function readSnapshot(id:string):Promise<Snapshot|null>{try{safeId(id)}catch{return null}const cached=fresh(snapshotMemory.get(id));if(cached!==undefined)return cached;let snapshot:Snapshot|null=null;if(hasDatabase()){try{const stored=await readPostgresSnapshot(id);if(stored)snapshot=normalizeSnapshot(stored)}catch{}}if(!snapshot)try{snapshot=normalizeSnapshot(JSON.parse(await fs.readFile(path.join(historyDir,`${id}.json`),"utf8")))}catch{}snapshotMemory.set(id,timed(snapshot));return snapshot}
export async function readAllSnapshots():Promise<Record<string,Snapshot>>{const result:Record<string,Snapshot>={};if(hasDatabase()){try{const stored=await readAllPostgresSnapshots();for(const value of stored){const snapshot=normalizeSnapshot(value);result[snapshot.lotteryId]=snapshot}}catch{}}try{const names=(await fs.readdir(historyDir)).filter(name=>name.endsWith(".json")&&!result[name.slice(0,-5)]),snapshots=await Promise.all(names.map(async name=>normalizeSnapshot(JSON.parse(await fs.readFile(path.join(historyDir,name),"utf8")))));for(const snapshot of snapshots)result[snapshot.lotteryId]=snapshot}catch{}return result}
export async function atomicWriteFile(target:string,contents:string){await fs.mkdir(path.dirname(target),{recursive:true});const temporary=path.join(path.dirname(target),`.${path.basename(target)}.${randomUUID()}.tmp`);let handle:Awaited<ReturnType<typeof fs.open>>|undefined;try{handle=await fs.open(temporary,"wx");await handle.writeFile(contents,"utf8");await handle.sync();await handle.close();handle=undefined;await fs.rename(temporary,target)}catch(error){await handle?.close().catch(()=>undefined);await fs.unlink(temporary).catch(()=>undefined);throw error}}
export async function writeSnapshot(lotteryId:string,draws:LotteryDraw[],freshness?:SnapshotFreshness,metadata?:{currentSourceResultDate?:string|null;syncOutcome?:SyncOutcome}):Promise<Snapshot>{const now=new Date().toISOString(),snapshot:Snapshot={lotteryId,syncedAt:now,lastSuccessfulSyncAt:now,source:"AllHuay",draws,historyVersion:computeHistoryVersion(lotteryId,draws),drawCount:draws.length,latestCompleteDrawDate:draws.find(isCompleteDraw)?.drawDate??null,currentSourceResultDate:metadata?.currentSourceResultDate??draws[0]?.drawDate??null,syncOutcome:metadata?.syncOutcome??"updated",...(freshness?{freshness}:{})};safeId(lotteryId);if(hasDatabase())await writePostgresSnapshot(snapshot);else await atomicWriteFile(path.join(historyDir,`${lotteryId}.json`),JSON.stringify(snapshot,null,2));snapshotMemory.set(lotteryId,timed(snapshot));return snapshot}
