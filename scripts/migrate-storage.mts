import nextEnv from "@next/env";
import { migrateDatabase } from "../src/lib/database";

nextEnv.loadEnvConfig(process.cwd());
await migrateDatabase();
console.log("Neon storage schema is ready.");
