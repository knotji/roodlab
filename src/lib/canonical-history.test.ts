import { describe, expect, it } from "vitest";
import type { Snapshot } from "./cache";
import { atomicWriteFile, computeHistoryVersion } from "./cache";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { validateCanonicalSync } from "./canonical-history";
import {
  canonicalDatasetIdentity,
  getCanonicalDataset,
} from "./history-provider";
import {
  buildCanonicalHistory,
  parseAllHuayCurrentResult,
  parseAllHuayHistory,
  parseDate,
  verifiedNormalizationRules,
} from "./data-sources/allhuay/parser";

const url = "https://example.com/lotto/demo";
const fixture = `<section id="lotto-latest-results"><div class="result-container"><h1 class="result-header-title">ตรวจหวย งวด 26 สิงหาคม 2569</h1><div class="result-item"><span class="result-item-label">3 ตัวบน</span><span class="result-item-value">755</span></div><div class="result-item"><span class="result-item-label">2 ตัวบน</span><span class="result-item-value">55</span></div><div class="result-item"><span class="result-item-label">2 ตัวล่าง</span><span class="result-item-value">12</span></div></div></section><table><tr><th>งวดวันที่</th><th>3 ตัวบน</th><th>2 ตัวบน</th><th>2 ตัวล่าง</th></tr><tr><td>25 สิงหาคม 2569</td><td>868</td><td>68</td><td>59</td></tr><tr><td>24 สิงหาคม 2569</td><td>871</td><td>71</td><td>65</td></tr></table>`;
const canonical = () =>
  buildCanonicalHistory(
    parseAllHuayCurrentResult(fixture),
    parseAllHuayHistory(fixture, "demo", url),
    "demo",
    url,
  ).draws;
const snapshot = (draws = canonical()): Snapshot => ({
  lotteryId: "demo",
  syncedAt: "2026-08-26T00:00:00Z",
  source: "AllHuay",
  draws,
  historyVersion: computeHistoryVersion("demo", draws),
});

describe("canonical history contract", () => {
  it("merges the complete hero ahead of the historical table with provenance", () => {
    const draws = canonical();
    expect(draws.map((x) => x.drawDate)).toEqual([
      "2026-08-26",
      "2026-08-25",
      "2026-08-24",
    ]);
    expect(draws[0]).toMatchObject({
      top3: "755",
      top2: "55",
      bottom2: "12",
      source: "current-result",
      completeness: "complete",
    });
    expect(draws[1].source).toBe("historical-table");
  });
  it("keeps a partial hero canonical but excludes it from analysis", () => {
    const partial = fixture.replace(
      '<div class="result-item"><span class="result-item-label">2 ตัวล่าง</span><span class="result-item-value">12</span></div>',
      "",
    );
    const draws = buildCanonicalHistory(
        parseAllHuayCurrentResult(partial),
        parseAllHuayHistory(partial, "demo", url),
        "demo",
        url,
      ).draws,
      data = getCanonicalDataset(snapshot(draws), 30);
    expect(draws[0].completeness).toBe("partial");
    expect(data.analysisHistory[0].drawDate).toBe("2026-08-25");
    expect(data.integrity.partialDraws).toBe(1);
  });
  it("derives top2 only when the explicit lottery rule allows it", () => {
    const noTop2 = fixture.replace(
      '<div class="result-item"><span class="result-item-label">2 ตัวบน</span><span class="result-item-value">55</span></div>',
      "",
    );
    expect(parseAllHuayCurrentResult(noTop2)?.top2).toBeUndefined();
    expect(
      parseAllHuayCurrentResult(noTop2, { deriveTop2FromTop3: true })?.top2,
    ).toBe("55");
  });
  it("enables derivation only from sufficient matching per-lottery history", () => {
    const history = canonical().slice(1);
    expect(verifiedNormalizationRules(history).deriveTop2FromTop3).toBe(false);
    expect(verifiedNormalizationRules([...history, {...history[0], id: "demo-extra", drawDate: "2026-08-23"}]).deriveTop2FromTop3).toBe(true);
    expect(verifiedNormalizationRules([...history, {...history[0], id: "demo-bad", drawDate: "2026-08-23", top2: "00"}]).deriveTop2FromTop3).toBe(false);
  });
  it("normalizes Buddhist Era dates", () =>
    expect(parseDate("26 สิงหาคม 2569")).toBe("2026-08-26"));
  it("gives every page the same dataset identity", () => {
    const identity = canonicalDatasetIdentity(snapshot());
    const consumers = [
      "Analyze",
      "Statistics",
      "History",
      "Backtest",
      "Formula Lab",
    ].map(() => identity);
    expect(new Set(consumers.map((x) => JSON.stringify(x))).size).toBe(1);
    expect(identity).toMatchObject({
      lotteryId: "demo",
      latestDrawDate: "2026-08-26",
      historyLength: 3,
    });
  });
  it("changes a content hash for a newly merged draw and stays stable otherwise", () => {
    const a = computeHistoryVersion("demo", canonical()),
      b = computeHistoryVersion("demo", canonical()),
      older = canonical().slice(1);
    expect(a).toBe(b);
    expect(a).not.toBe(computeHistoryVersion("demo", older));
    const decision = validateCanonicalSync(snapshot(older), {
      draws: canonical(),
      currentSourceResultDate: "2026-08-26",
      conflicts: 0,
      template: "hero+history",
    });
    expect(decision).toMatchObject({
      ok: true,
      outcome: "updated",
      addedDraws: 1,
    });
  });
  it("preserves last known good data on zero results or suspicious truncation", () => {
    const old = Array.from({ length: 100 }, (_, i) => ({
        id: `demo-${i}`,
        lotteryId: "demo",
        drawDate: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
        top3: "755",
        top2: "55",
        bottom2: "12",
      })).sort((a, b) => b.drawDate.localeCompare(a.drawDate)),
      current = snapshot(old);
    expect(
      validateCanonicalSync(current, {
        draws: [],
        currentSourceResultDate: null,
        conflicts: 0,
        template: "unsupported-template",
      }),
    ).toMatchObject({ ok: false, outcome: "parse-failure" });
    expect(
      validateCanonicalSync(current, {
        draws: old.slice(0, 2),
        currentSourceResultDate: old[0].drawDate,
        conflicts: 0,
        template: "history-only",
      }),
    ).toMatchObject({ ok: false, outcome: "validation-failure" });
    expect(current.historyVersion).toBe(computeHistoryVersion("demo", old));
  });
  it("keeps walk-forward training strictly before the hero evaluation date", async () => {
    const { backtest } = await import("./analysis/backtest");
    const draws = Array.from({ length: 31 }, (_, i) => {
        const date = new Date(Date.UTC(2026, 6, 27 + i))
          .toISOString()
          .slice(0, 10);
        return {
          id: `demo-${date}`,
          lotteryId: "demo",
          drawDate: date,
          top3: "755",
          top2: "55",
          bottom2: "12",
          source:
            i === 30
              ? ("current-result" as const)
              : ("historical-table" as const),
          completeness: "complete" as const,
        };
      }).sort((a, b) => b.drawDate.localeCompare(a.drawDate)),
      row = backtest(draws, 30, 1)[0];
    expect(row.trainingEnd < row.draw.drawDate).toBe(true);
  });
  it("atomically replaces a completed payload without leaving temp files", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "roodlab-"));
    const target = path.join(dir, "history.json");
    try {
      await atomicWriteFile(target, "old");
      await atomicWriteFile(target, "new");
      expect(await fs.readFile(target, "utf8")).toBe("new");
      expect((await fs.readdir(dir)).filter((x) => x.endsWith(".tmp"))).toEqual([]);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
