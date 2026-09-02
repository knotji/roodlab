import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("global prospective integration paths", () => {
  it("does not create a global snapshot from the cron route", async () => {
    const source = await readFile(new URL("../app/api/cron/prospective-sync/route.ts", import.meta.url), "utf8");
    expect(source).not.toContain("captureNextGlobalProspective");
    expect(source).not.toContain("globalSnapshot");
  });

  it("keeps per-lottery reconciliation and removes only global reconciliation", async () => {
    const source = await readFile(new URL("./sync-service.ts", import.meta.url), "utf8");
    expect(source).toContain("reconcileProspectiveOutcomes");
    expect(source).not.toContain("reconcileGlobalProspectiveOutcomes");
  });
});
