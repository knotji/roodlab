import { describe, expect, it } from "vitest";
import {
  analyzeLottery,
  analyzeProductionLottery,
  PRODUCTION_ALGORITHM_ID,
} from "./engine";
import { compareAlgorithms } from "./formula-lab";
import { ALGORITHMS } from "./algorithms";
import { fixtureHistory } from "../fixtures";
import { useLotteryStore } from "../lottery-store";
describe("production analysis path", () => {
  it("always uses frozen Balanced v1", () => {
    expect(PRODUCTION_ALGORITHM_ID).toBe("balanced-v1");
    expect(analyzeProductionLottery(fixtureHistory)).toEqual(
      analyzeLottery(fixtureHistory, { algorithmId: "balanced-v1" }),
    );
  });
  it("ignores a persisted experimental selection in normal analysis", () => {
    useLotteryStore.setState({ algorithmId: "momentum" });
    expect(analyzeProductionLottery(fixtureHistory).algorithmId).toBe(
      "balanced-v1",
    );
    expect(useLotteryStore.getState().algorithmId).toBe("momentum");
  });
  it("keeps Formula Lab comparisons available", () =>
    expect(
      compareAlgorithms(fixtureHistory, 30, 30).map((x) => x.algorithmId),
    ).toEqual(ALGORITHMS.map((x) => x.id)));
  it("does not disturb unrelated persisted preferences", () => {
    useLotteryStore.setState({
      favoriteLotteryIds: ["goverment"],
      recentLotteryIds: ["goverment"],
      algorithmId: "frequency",
    });
    analyzeProductionLottery(fixtureHistory);
    expect(useLotteryStore.getState()).toMatchObject({
      favoriteLotteryIds: ["goverment"],
      recentLotteryIds: ["goverment"],
      algorithmId: "frequency",
    });
  });
  it("is deterministic", () =>
    expect(analyzeProductionLottery(fixtureHistory)).toEqual(
      analyzeProductionLottery(fixtureHistory),
    ));
});
