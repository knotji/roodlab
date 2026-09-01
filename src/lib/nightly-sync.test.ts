import { describe, expect, it } from "vitest";
import { rotatingCoverageIds } from "./nightly-sync";

describe("rotatingCoverageIds", () => {
  it("prioritizes due lotteries and fills from the rotating catalog", () => {
    expect(rotatingCoverageIds(["a", "b", "c", "d"], ["d"], 1, 3)).toEqual({ ids: ["d", "b", "c"], nextCursor: 3 });
  });
  it("deduplicates due lotteries and respects the cap", () => {
    expect(rotatingCoverageIds(["a", "b"], ["b", "b", "a"], 0, 2).ids).toEqual(["b", "a"]);
  });
});
