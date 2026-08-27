import { describe, expect, it } from "vitest";
import { historyVersion, memoizedAnalyze } from "./cache";
import type { LotteryDraw } from "../types";

const sampleDraws = (latest: string, previous: string): LotteryDraw[] => [
  {
    id: `demo-${latest}`,
    lotteryId: "demo",
    drawDate: latest,
    top3: "123",
    top2: "23",
    bottom2: "45",
  },
  {
    id: `demo-${previous}`,
    lotteryId: "demo",
    drawDate: previous,
    top3: "456",
    top2: "56",
    bottom2: "78",
  },
];

describe("analysis cache", () => {
  it("changes history version when newest draw changes", () => {
    const before = historyVersion(sampleDraws("2026-08-25", "2026-08-24"));
    const after = historyVersion(sampleDraws("2026-08-26", "2026-08-25"));
    expect(before).not.toBe(after);
  });

  it("recalculates analysis after history changes", () => {
    const options = {
      window: 2,
      candidateCount: 2,
      includeDoubles: true,
      algorithmId: "classic",
    };
    const before = memoizedAnalyze(
      "demo",
      sampleDraws("2026-08-25", "2026-08-24"),
      options,
    );
    const after = memoizedAnalyze(
      "demo",
      sampleDraws("2026-08-26", "2026-08-25"),
      options,
    );
    expect(before).not.toBe(after);
  });
});
