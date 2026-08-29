import { promises as fs } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { migrateDatabase } from "../src/lib/database";
import { writeDocument, writePostgresSnapshot } from "../src/lib/postgres-storage";
import { normalizeSnapshot } from "../src/lib/cache";

loadEnvConfig(process.cwd());
await migrateDatabase();

const dataDirectory = path.join(process.cwd(), "data");
const historyDirectory = path.join(dataDirectory, "history");
const catalog = JSON.parse(await fs.readFile(path.join(dataDirectory, "lotteries.json"), "utf8"));
await writeDocument("catalog", catalog);

try {
  const audit = JSON.parse(await fs.readFile(path.join(dataDirectory, "catalog-audit.json"), "utf8"));
  await writeDocument("catalog-audit", audit);
} catch {
  console.warn("No catalog audit file found; skipped.");
}

let imported = 0;
for (const filename of await fs.readdir(historyDirectory)) {
  if (!filename.endsWith(".json")) continue;
  const snapshot = normalizeSnapshot(JSON.parse(
    await fs.readFile(path.join(historyDirectory, filename), "utf8"),
  ));
  await writePostgresSnapshot(snapshot);
  imported += 1;
}

console.log(`Imported catalog and ${imported} lottery snapshots.`);
