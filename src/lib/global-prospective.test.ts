import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.fn();
vi.mock("./database", () => ({
  database: () => ({ query }),
  ensureDatabase: vi.fn(),
  hasDatabase: () => true,
}));

import {
  captureNextGlobalProspective,
  GLOBAL_PROSPECTIVE_WRITES_ENABLED,
  listGlobalProspective,
  reconcileGlobalProspectiveOutcomes,
} from "./global-prospective";

describe("disabled global prospective writes", () => {
  beforeEach(() => query.mockReset());

  it("does not create a new snapshot", async () => {
    expect(GLOBAL_PROSPECTIVE_WRITES_ENABLED).toBe(false);
    await expect(captureNextGlobalProspective()).resolves.toEqual({ created: false, reason: "global-prospective-disabled" });
    expect(query).not.toHaveBeenCalled();
  });

  it("does not reconcile outcomes", async () => {
    await expect(reconcileGlobalProspectiveOutcomes()).resolves.toBe(0);
    expect(query).not.toHaveBeenCalled();
  });

  it("keeps historical records readable", async () => {
    const records = [{ id: "existing-snapshot" }];
    query.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined).mockResolvedValueOnce(records);
    await expect(listGlobalProspective()).resolves.toEqual(records);
    expect(query.mock.calls.at(-1)?.[0]).toContain("global_prediction_snapshots");
  });
});
