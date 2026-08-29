import { loadEnvConfig } from "@next/env";
import { migrateDatabase } from "../src/lib/database";

loadEnvConfig(process.cwd());
await migrateDatabase();
console.log("Neon storage schema is ready.");

