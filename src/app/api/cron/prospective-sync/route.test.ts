import { beforeEach, describe, expect, it, vi } from "vitest";

const syncLotteryFromSource = vi.fn(), create = vi.fn(), recordItem = vi.fn(), finish = vi.fn(), latest = vi.fn();

vi.mock("@/lib/prospective", () => ({ pendingDueLotteryIds: async () => ["a", "b"] }));
vi.mock("@/lib/sync-service", () => ({ syncLotteryFromSource }));
vi.mock("@/lib/nightly-sync", () => ({ buildNightlySyncBatch: async (due: string[]) => ({ ids: due, eligibleCount: 5, dueCount: due.length, nextCursor: 0 }) }));
vi.mock("@/lib/database", () => ({ hasDatabase: vi.fn(() => true) }));
vi.mock("@/lib/nightly-sync-storage", () => ({ postgresNightlySyncRunStore: { create, recordItem, finish }, readLatestNightlySyncRun: latest }));

describe("prospective sync cron route", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { hasDatabase } = await import("@/lib/database");
    vi.mocked(hasDatabase).mockReturnValue(true);
    create.mockResolvedValue(undefined);
    recordItem.mockResolvedValue(undefined);
    finish.mockResolvedValue(undefined);
    process.env.CRON_SECRET = "cron-test-secret";
    syncLotteryFromSource.mockResolvedValue({ addedDraws: 1, reconciledPredictions: 0 });
  });

  it("rejects a missing secret configuration before syncing anything", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/cron/prospective-sync"));
    expect(response.status).toBe(503);
    expect(syncLotteryFromSource).not.toHaveBeenCalled();
  });

  it("rejects an unauthorized caller", async () => {
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/cron/prospective-sync"));
    expect(response.status).toBe(401);
    expect(syncLotteryFromSource).not.toHaveBeenCalled();
  });

  it("syncs due lotteries and returns the unchanged response shape", async () => {
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/cron/prospective-sync", { headers: { authorization: "Bearer cron-test-secret" } }));
    const body = await response.json() as { ok: boolean; checked: number; eligible: number; due: number; results: Array<{ lotteryId: string; ok: boolean }> };
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, checked: 2, eligible: 5, due: 2 });
    expect(body.results).toEqual([{ lotteryId: "a", ok: true, addedDraws: 1, reconciledPredictions: 0 }, { lotteryId: "b", ok: true, addedDraws: 1, reconciledPredictions: 0 }]);
  });

  it("persists a best-effort run ledger alongside the sync", async () => {
    const { GET } = await import("./route");
    await GET(new Request("http://localhost/api/cron/prospective-sync", { headers: { authorization: "Bearer cron-test-secret" } }));
    expect(create).toHaveBeenCalledOnce();
    expect(recordItem).toHaveBeenCalledTimes(2);
    expect(finish).toHaveBeenCalledOnce();
    expect(finish.mock.calls[0][0]).toMatchObject({ successCount: 2, failedCount: 0 });
  });

  it("still returns a normal response when a lottery sync fails, recording it as a failed ledger item", async () => {
    syncLotteryFromSource.mockResolvedValueOnce({ addedDraws: 1, reconciledPredictions: 0 }).mockRejectedValueOnce(new Error("provider unreachable"));
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/cron/prospective-sync", { headers: { authorization: "Bearer cron-test-secret" } }));
    const body = await response.json() as { results: Array<{ lotteryId: string; ok: boolean; error?: string }> };
    expect(response.status).toBe(200);
    expect(body.results[1]).toEqual({ lotteryId: "b", ok: false, error: "provider unreachable" });
    expect(finish.mock.calls[0][0]).toMatchObject({ successCount: 1, failedCount: 1 });
  });

  it("never lets a ledger write failure break the sync response", async () => {
    create.mockRejectedValue(new Error("db unavailable"));
    recordItem.mockRejectedValue(new Error("db unavailable"));
    finish.mockRejectedValue(new Error("db unavailable"));
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/cron/prospective-sync", { headers: { authorization: "Bearer cron-test-secret" } }));
    expect(response.status).toBe(200);
    expect(syncLotteryFromSource).toHaveBeenCalledTimes(2);
  });

  it("skips the ledger entirely when no database is configured, without failing the sync", async () => {
    const { hasDatabase } = await import("@/lib/database");
    vi.mocked(hasDatabase).mockReturnValue(false);
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/cron/prospective-sync", { headers: { authorization: "Bearer cron-test-secret" } }));
    expect(response.status).toBe(200);
    expect(create).not.toHaveBeenCalled();
  });

  it("keeps authenticated status inspection read-only", async () => {
    latest.mockResolvedValue({ id: "run-1", startedAt: "2026-09-13T00:00:00.000Z" });
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/cron/prospective-sync?status=1", { headers: { authorization: "Bearer cron-test-secret" } }));
    expect(response.status).toBe(200);
    expect(latest).toHaveBeenCalledOnce();
    expect(syncLotteryFromSource).not.toHaveBeenCalled();
  });

  it("reports status unavailable without a database instead of syncing", async () => {
    const { hasDatabase } = await import("@/lib/database");
    vi.mocked(hasDatabase).mockReturnValue(false);
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/cron/prospective-sync?status=1", { headers: { authorization: "Bearer cron-test-secret" } }));
    expect(response.status).toBe(503);
    expect(syncLotteryFromSource).not.toHaveBeenCalled();
  });
});
