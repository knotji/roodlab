import { describe, expect, it } from "vitest";
import type { LotteryDraw } from "../types";
import { aggregateRankConsensus, buildGlobalRankConsensus, buildRankConsensusBallots, classifyRankConsensusPair, evaluateRankConsensusOutcome, rankPoints } from "./global-rank-consensus-study";
import { GLOBAL_WEEKDAY_LOOKBACK } from "./global-weekday-win";

const draw = (lotteryId: string, drawDate: string, top2?: string, bottom2?: string): LotteryDraw => ({
  id: `${lotteryId}-${drawDate}-${top2}-${bottom2}`, lotteryId, drawDate, top3: top2 ? `0${top2}` : undefined, top2, bottom2,
});

describe("global rank consensus research", () => {
  it("assigns fixed 10 through 1 rank points", () => {
    expect(Array.from({ length: 10 }, (_, index) => rankPoints(index + 1))).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  });

  it("uses one equally weighted ballot per eligible lottery and skips unavailable sources", () => {
    const ballots = buildRankConsensusBallots([
      { lotteryId: "many", draws: Array.from({ length: 12 }, (_, index) => draw("many", `2026-${String(8 - Math.floor(index / 4)).padStart(2, "0")}-${String(25 - (index % 4) * 7).padStart(2, "0")}`, "11", "11")) },
      { lotteryId: "one", draws: [draw("one", "2026-08-25", "99", "99")] },
      { lotteryId: "missing", draws: [] },
    ], { weekday: 2, cutoffDate: "2026-09-01" });
    expect(ballots.map((item) => item.lotteryId)).toEqual(["many", "one"]);
    expect(ballots).toHaveLength(2);
    const ranking = aggregateRankConsensus(ballots);
    for (const digit of ["1", "9"]) {
      const expected = ballots.reduce((total, ballot) => total + rankPoints(ballot.ranking.findIndex((item) => item.digit === digit) + 1), 0) / ballots.length;
      expect(ranking.find((item) => item.digit === digit)?.score).toBe(expected);
    }
  });

  it("uses deterministic digit ordering for local and global ties", () => {
    const result = buildGlobalRankConsensus([{ lotteryId: "a", draws: [draw("a", "2026-08-25", "00", "00")] }], { weekday: 2, cutoffDate: "2026-09-01" });
    expect(result.ballots[0].ranking.slice(1).map((item) => item.digit)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
    expect(aggregateRankConsensus([])).toEqual([]);
    expect(result.digits).toHaveLength(6);
    expect(new Set(result.digits).size).toBe(6);
    const forward = result.ballots[0].ranking,
      reverse = [...forward].reverse().map((item) => ({ ...item })),
      tied = aggregateRankConsensus([{ lotteryId: "forward", ranking: forward }, { lotteryId: "reverse", ranking: reverse }]);
    expect(tied.map((item) => item.digit)).toEqual(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
  });

  it("preserves leading zeroes, doubles, and excludes target and future draws", () => {
    const result = buildGlobalRankConsensus([{ lotteryId: "a", draws: [
      draw("a", "2026-09-08", "99", "99"), draw("a", "2026-09-01", "88", "88"), draw("a", "2026-08-25", "00", "05"),
    ] }], { weekday: 2, cutoffDate: "2026-09-01" });
    expect(result.ballots[0].ranking[0].digit).toBe("0");
    expect(result.ballots[0].ranking.find((item) => item.digit === "5")?.score).toBeGreaterThan(0);
    expect(result.ballots[0].ranking.find((item) => item.digit === "8")?.score).toBe(0);
    expect(result.ballots[0].ranking.find((item) => item.digit === "9")?.score).toBe(0);
    expect(evaluateRankConsensusOutcome(["0", "5", "1", "2", "3", "4"], "00", "05")).toMatchObject({ top: true, bottom: true, either: true, both: true });
  });

  it("classifies paired primary outcomes", () => {
    expect(GLOBAL_WEEKDAY_LOOKBACK).toBe(12);
    expect(classifyRankConsensusPair({ either: true }, { either: true })).toBe("both");
    expect(classifyRankConsensusPair({ either: true }, { either: false })).toBe("productionOnly");
    expect(classifyRankConsensusPair({ either: false }, { either: true })).toBe("consensusOnly");
    expect(classifyRankConsensusPair({ either: false }, { either: false })).toBe("neither");
  });
});
