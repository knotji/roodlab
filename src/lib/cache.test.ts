import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hasDatabase = vi.fn();
const readDocument = vi.fn();
const writeDocument = vi.fn();
const readAllPostgresSnapshots = vi.fn();
const readPostgresSnapshot = vi.fn();
const readPostgresSnapshots = vi.fn();
const writePostgresSnapshot = vi.fn();

vi.mock("./database", () => ({ hasDatabase }));
vi.mock("./postgres-storage", () => ({
  readDocument, writeDocument, readAllPostgresSnapshots, readPostgresSnapshot, readPostgresSnapshots, writePostgresSnapshot,
}));
// readAllSnapshots merges in local history/*.json files not already returned by the
// DB - stub readdir so real files under data/history don't leak into these tests.
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, promises: { ...actual.promises, readdir: vi.fn().mockRejectedValue(new Error("no local history dir in tests")) } };
});

async function freshCacheModule() { vi.resetModules(); return import("./cache"); }

function snapshotFixture(id: string, drawDate = "2026-09-01") {
  return { lotteryId: id, syncedAt: "2026-09-01T00:00:00.000Z", source: "AllHuay", draws: [{ id: `${id}-${drawDate}`, lotteryId: id, drawDate, top3: "007", top2: "07", bottom2: "07" }] };
}

beforeEach(() => {
  vi.clearAllMocks();
  hasDatabase.mockReturnValue(true);
  readDocument.mockResolvedValue([{ id: "placeholder", name: "placeholder" }]);
});
afterEach(() => { vi.useRealTimers(); });

describe("readCatalog / writeCatalog caching", () => {
  const lottery = (id: string, name: string) => ({ id, name, slug: id, category: "test", sourceUrl: "https://example.com" });

  it("caches the catalog within the TTL window", async () => {
    const { readCatalog } = await freshCacheModule();
    readDocument.mockResolvedValue([lottery("a", "A")]);
    const first = await readCatalog(), second = await readCatalog();
    expect(first).toEqual([lottery("a", "A")]);
    expect(second).toBe(first);
    expect(readDocument).toHaveBeenCalledTimes(1);
  });

  it("updates the cache immediately on write, without re-reading storage", async () => {
    const { readCatalog, writeCatalog } = await freshCacheModule();
    await readCatalog();
    expect(readDocument).toHaveBeenCalledTimes(1);
    const updated = [lottery("b", "B")];
    await writeCatalog(updated);
    const result = await readCatalog();
    expect(result).toEqual(updated);
    expect(readDocument).toHaveBeenCalledTimes(1);
  });

  it("re-reads storage after the TTL expires", async () => {
    vi.useFakeTimers();
    const { readCatalog } = await freshCacheModule();
    readDocument.mockResolvedValue([lottery("a", "A")]);
    await readCatalog();
    expect(readDocument).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(31_000);
    readDocument.mockResolvedValue([lottery("a2", "A2")]);
    const result = await readCatalog();
    expect(result).toEqual([lottery("a2", "A2")]);
    expect(readDocument).toHaveBeenCalledTimes(2);
  });
});

describe("readCatalogAudit / writeCatalogAudit caching", () => {
  it("caches the audit report within the TTL window", async () => {
    const { readCatalogAudit } = await freshCacheModule();
    readDocument.mockResolvedValue({ items: [{ id: "a", status: "supported" }] });
    const first = await readCatalogAudit(), second = await readCatalogAudit();
    expect(first).toEqual({ a: { status: "supported", reason: undefined } });
    expect(second).toBe(first);
    expect(readDocument).toHaveBeenCalledTimes(1);
  });

  it("invalidates the cache on write so the next read is fresh", async () => {
    const { readCatalogAudit, writeCatalogAudit } = await freshCacheModule();
    readDocument.mockResolvedValue({ items: [{ id: "a", status: "supported" }] });
    await readCatalogAudit();
    expect(readDocument).toHaveBeenCalledTimes(1);
    await writeCatalogAudit({ items: [{ id: "a", status: "failed" }] });
    readDocument.mockResolvedValue({ items: [{ id: "a", status: "failed" }] });
    const result = await readCatalogAudit();
    expect(result).toEqual({ a: { status: "failed", reason: undefined } });
    expect(readDocument).toHaveBeenCalledTimes(2);
  });
});

describe("readAllSnapshots / writeSnapshot caching", () => {
  it("caches all snapshots within the TTL window", async () => {
    const { readAllSnapshots } = await freshCacheModule();
    readAllPostgresSnapshots.mockResolvedValue([snapshotFixture("laotv")]);
    const first = await readAllSnapshots(), second = await readAllSnapshots();
    expect(Object.keys(first)).toEqual(["laotv"]);
    expect(second).toBe(first);
    expect(readAllPostgresSnapshots).toHaveBeenCalledTimes(1);
  });

  it("invalidates the all-snapshots cache when a snapshot is written", async () => {
    const { readAllSnapshots, writeSnapshot } = await freshCacheModule();
    readAllPostgresSnapshots.mockResolvedValue([snapshotFixture("laotv")]);
    await readAllSnapshots();
    expect(readAllPostgresSnapshots).toHaveBeenCalledTimes(1);
    await writeSnapshot("hanoi", [{ id: "hanoi-2026-09-02", lotteryId: "hanoi", drawDate: "2026-09-02", top3: "111", top2: "11", bottom2: "11" }]);
    readAllPostgresSnapshots.mockResolvedValue([snapshotFixture("laotv"), snapshotFixture("hanoi", "2026-09-02")]);
    const result = await readAllSnapshots();
    expect(Object.keys(result).sort()).toEqual(["hanoi", "laotv"]);
    expect(readAllPostgresSnapshots).toHaveBeenCalledTimes(2);
  });

  it("re-queries all snapshots after the TTL expires", async () => {
    vi.useFakeTimers();
    const { readAllSnapshots } = await freshCacheModule();
    readAllPostgresSnapshots.mockResolvedValue([snapshotFixture("laotv")]);
    await readAllSnapshots();
    expect(readAllPostgresSnapshots).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(31_000);
    readAllPostgresSnapshots.mockResolvedValue([snapshotFixture("laotv"), snapshotFixture("hanoi", "2026-09-02")]);
    const result = await readAllSnapshots();
    expect(Object.keys(result).sort()).toEqual(["hanoi", "laotv"]);
    expect(readAllPostgresSnapshots).toHaveBeenCalledTimes(2);
  });
});

describe("readSnapshot / writeSnapshot per-id caching", () => {
  it("caches a single snapshot within the TTL window", async () => {
    const { readSnapshot } = await freshCacheModule();
    readPostgresSnapshot.mockResolvedValue(snapshotFixture("laotv"));
    const first = await readSnapshot("laotv"), second = await readSnapshot("laotv");
    expect(first?.lotteryId).toBe("laotv");
    expect(second).toBe(first);
    expect(readPostgresSnapshot).toHaveBeenCalledTimes(1);
  });

  it("updates the cached entry immediately when the snapshot is written", async () => {
    const { readSnapshot, writeSnapshot } = await freshCacheModule();
    readPostgresSnapshot.mockResolvedValue(snapshotFixture("laotv", "2026-09-01"));
    await readSnapshot("laotv");
    expect(readPostgresSnapshot).toHaveBeenCalledTimes(1);
    await writeSnapshot("laotv", [{ id: "laotv-2026-09-02", lotteryId: "laotv", drawDate: "2026-09-02", top3: "222", top2: "22", bottom2: "22" }]);
    const result = await readSnapshot("laotv");
    expect(result?.draws[0]?.drawDate).toBe("2026-09-02");
    expect(readPostgresSnapshot).toHaveBeenCalledTimes(1);
  });
});
