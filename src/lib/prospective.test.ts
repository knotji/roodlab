import { afterEach, describe, expect, it } from "vitest";
import { captureProspective, listProspective } from "./prospective";
import { getSystemStatus } from "./system-status";

const previousDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (previousDatabaseUrl) process.env.DATABASE_URL = previousDatabaseUrl;
  else delete process.env.DATABASE_URL;
});

describe("prospective storage boundary", () => {
  it("returns an empty list when Neon is not configured", async () => {
    delete process.env.DATABASE_URL;
    await expect(listProspective("demo")).resolves.toEqual([]);
  });

  it("refuses to pretend a snapshot was locked without durable storage", async () => {
    delete process.env.DATABASE_URL;
    await expect(captureProspective("demo", {})).rejects.toThrow("Neon");
  });

  it("reports JSON fallback honestly without a database", async () => {
    delete process.env.DATABASE_URL;
    await expect(getSystemStatus()).resolves.toMatchObject({ storage: "json-fallback", connected: false });
  });
});
