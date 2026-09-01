import nextEnv from "@next/env";
import { promises as fs } from "node:fs";
import path from "node:path";
import { buildBackfillPlan, parseBackfillNumber } from "../src/lib/backfill";
import { atomicWriteFile, normalizeSnapshot, readCatalog, readCatalogAudit } from "../src/lib/cache";
import { hasDatabase, migrateDatabase } from "../src/lib/database";
import { readAllPostgresSnapshots } from "../src/lib/postgres-storage";
import { syncLotteryFromSource } from "../src/lib/sync-service";
import { isCompleteDraw } from "../src/lib/data-sources/integrity";

nextEnv.loadEnvConfig(process.cwd());
const args = process.argv.slice(2), execute = args.includes("--execute"), force = args.includes("--force"), value = (name:string) => args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1),
  concurrency = parseBackfillNumber(value("--concurrency"), 2, 1, 4), retries = parseBackfillNumber(value("--retries"), 2, 0, 5), limitRaw = value("--limit"), limit = limitRaw ? parseBackfillNumber(limitRaw, 15, 1, 151) : undefined,
  stateDir = path.join(process.cwd(), ".backfill"), checkpointPath = path.join(stateDir, "checkpoint.json"), reportPath = path.join(stateDir, "latest-report.json");
type Checkpoint = { completed: string[]; failures: Record<string,{attempts:number;error:string}>; updatedAt?:string };
let checkpoint: Checkpoint = { completed: [], failures: {} };
try { checkpoint = JSON.parse(await fs.readFile(checkpointPath, "utf8")) as Checkpoint; } catch {}
if (args.includes("--reset-checkpoint")) checkpoint = { completed: [], failures: {} };

const [catalog, audit] = await Promise.all([readCatalog(), readCatalogAudit()]);
let hydratedIds: string[] = [];
if (hasDatabase()) {
  await migrateDatabase();
  hydratedIds = (await readAllPostgresSnapshots()).map((item) => normalizeSnapshot(item)).filter((item) => item.draws.filter(isCompleteDraw).length >= 20).map((item) => item.lotteryId);
}
const plan = buildBackfillPlan({ catalog, audit, hydratedIds, checkpointIds: force ? [] : checkpoint.completed, force, limit });
console.log(JSON.stringify({ mode: execute ? "execute" : "dry-run", concurrency, retries, force, ...plan, items: plan.items.map((item) => ({ id:item.id, name:item.name, status:item.status })) }, null, 2));
if (!execute) process.exit(0);
if (!hasDatabase()) throw new Error("DATABASE_URL is required for --execute. Put it in .env.local; do not commit it.");

await fs.mkdir(stateDir, { recursive: true });
const results: { id:string; ok:boolean; attempts:number; addedDraws?:number; outcome?:string; error?:string }[] = [], queue = [...plan.items];
async function saveCheckpoint() { checkpoint.updatedAt = new Date().toISOString(); await atomicWriteFile(checkpointPath, JSON.stringify(checkpoint, null, 2)); }
async function runOne(id:string) {
  let lastError = "unknown error";
  for (let attempt=1; attempt<=retries+1; attempt+=1) try {
    const result = await syncLotteryFromSource(id);
    checkpoint.completed = [...new Set([...checkpoint.completed, id])].sort(); delete checkpoint.failures[id]; await saveCheckpoint();
    return { id, ok:true, attempts:attempt, addedDraws:result.addedDraws, outcome:result.outcome };
  } catch (error) {
    lastError = error instanceof Error ? error.message : "sync failed";
    checkpoint.failures[id] = { attempts:attempt, error:lastError }; await saveCheckpoint();
    if (attempt <= retries) await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
  }
  return { id, ok:false, attempts:retries+1, error:lastError };
}
async function worker() { while (queue.length) { const item = queue.shift(); if (!item) return; const result = await runOne(item.id); results.push(result); console.log(`${result.ok ? "OK" : "FAIL"} ${item.id} (${result.attempts} attempt${result.attempts===1?"":"s"})`); } }
await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));
const report = { startedFrom: { eligible:plan.eligibleCount, hydrated:plan.hydratedCount, checkpoint:plan.checkpointCount }, finishedAt:new Date().toISOString(), attempted:results.length, succeeded:results.filter((item)=>item.ok).length, failed:results.filter((item)=>!item.ok).length, results };
await atomicWriteFile(reportPath, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
if (report.failed) process.exitCode = 1;
