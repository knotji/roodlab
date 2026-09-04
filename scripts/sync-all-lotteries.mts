import nextEnv from "@next/env";
import { promises as fs } from "node:fs";
import path from "node:path";
import { syncAllLotteries } from "../src/lib/all-lottery-sync";
import { atomicWriteFile } from "../src/lib/cache";

nextEnv.loadEnvConfig(process.cwd());
const args = process.argv.slice(2), concurrencyArg = args.find((arg) => arg.startsWith("--concurrency=")),
  concurrency = concurrencyArg ? Number(concurrencyArg.split("=")[1]) : 3,
  outputArg = args.find((arg) => arg.startsWith("--output=")), output = outputArg?.slice("--output=".length);
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 6) throw new Error("--concurrency must be an integer from 1 to 6");
const summary = await syncAllLotteries({ concurrency, retries: 1, onProgress(completed, total, item) {
  console.log(`[${completed}/${total}] ${item.outcome.toUpperCase()} ${item.id}${item.error ? ` - ${item.error}` : ""}`);
} });
if (output) {
  const target = path.resolve(process.cwd(), output);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await atomicWriteFile(target, JSON.stringify(summary, null, 2));
}
console.log(JSON.stringify({ ...summary, items: undefined }, null, 2));
if (summary.failed) process.exitCode = 1;
