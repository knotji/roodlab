import { describe, expect, it } from "vitest";
import {
  buildFrequencyTop21,
  buildJoint21,
  canonicalizeReversePair,
  classifyJoint21,
  evaluateJoint21,
  expandCanonicalPairs,
  historicalJointEvents,
} from "./global-joint-21";
import type { LotteryDraw } from "../types";
const draw = (
  lotteryId: string,
  drawDate: string,
  top2: string,
  bottom2: string,
): LotteryDraw => ({
  id: `${lotteryId}-${drawDate}`,
  lotteryId,
  drawDate,
  top2,
  bottom2,
  top3: `0${top2}`,
});
describe("Joint 21 research", () => {
  it("canonicalizes reverse pairs and preserves leading zeroes", () => {
    expect(canonicalizeReversePair("70")).toBe("07");
    expect(canonicalizeReversePair("56")).toBe(canonicalizeReversePair("65"));
    expect(expandCanonicalPairs(["07", "11"])).toEqual(["07", "70", "11"]);
  });
  it("derives doubles, selects exactly 21 unique pairs, and is deterministic", () => {
    const sources = [
        { lotteryId: "a", draws: [draw("a", "2026-08-29", "12", "34")] },
      ],
      a = buildJoint21(sources, { weekday: 6, cutoffDate: "2026-09-05" }),
      b = buildJoint21(sources, { weekday: 6, cutoffDate: "2026-09-05" });
    expect(a).toEqual(b);
    expect(a.selectedPairs).toHaveLength(21);
    expect(new Set(a.selectedPairs).size).toBe(21);
    expect(a.selectedDoubles).toEqual(
      a.selectedPairs.filter((p) => p[0] === p[1]).map((p) => p[0]),
    );
  });
  it("filters weekday, future, and max 12", () => {
    const draws = Array.from({ length: 15 }, (_, i) =>
      draw(
        "a",
        `2026-${String(5 + Math.floor(i / 4)).padStart(2, "0")}-${String(2 + (i % 4) * 7).padStart(2, "0")}`,
        "12",
        "34",
      ),
    );
    draws.push(draw("a", "2026-09-06", "99", "99"));
    const rows = historicalJointEvents([{ lotteryId: "a", draws }], {
      weekday: 6,
      cutoffDate: "2026-09-05",
    });
    expect(rows[0].events.length).toBeLessThanOrEqual(12);
    expect(rows[0].events.every((e) => e.topPair !== "99")).toBe(true);
  });
  it("classifies both, top-only, bottom-only, and miss", () => {
    const set = new Set(["12", "34"]);
    expect(classifyJoint21(set, { topPair: "21", bottomPair: "43" })).toBe(
      "both",
    );
    expect(classifyJoint21(set, { topPair: "12", bottomPair: "56" })).toBe(
      "topOnly",
    );
    expect(classifyJoint21(set, { topPair: "56", bottomPair: "34" })).toBe(
      "bottomOnly",
    );
    expect(classifyJoint21(set, { topPair: "56", bottomPair: "78" })).toBe(
      "miss",
    );
  });
  it("uses marginal joint coverage rather than frequency output", () => {
    const sources = [
        {
          lotteryId: "a",
          draws: [
            draw("a", "2026-08-29", "12", "34"),
            draw("a", "2026-08-22", "12", "56"),
          ],
        },
        { lotteryId: "b", draws: [draw("b", "2026-08-29", "34", "12")] },
      ],
      j = buildJoint21(sources, { weekday: 6, cutoffDate: "2026-09-05" }),
      f = buildFrequencyTop21(sources, {
        weekday: 6,
        cutoffDate: "2026-09-05",
      });
    expect(j.selectedPairs).toHaveLength(21);
    expect(f.selectedPairs).toHaveLength(21);
    expect(j.bothHitRate).toBeGreaterThanOrEqual(f.bothHitRate);
  });
  it("weights each lottery equally regardless of its observation count", () => {
    const many = Array.from({ length: 12 }, () => ({
        topPair: "12",
        bottomPair: "12",
      })),
      metrics = evaluateJoint21(
        ["12"],
        [
          { lotteryId: "many", events: many },
          { lotteryId: "one", events: [{ topPair: "34", bottomPair: "34" }] },
        ],
      );
    expect(metrics.bothHitRate).toBe(0.5);
    expect(metrics.topHitRate).toBe(0.5);
    expect(metrics.bottomHitRate).toBe(0.5);
  });
  it("uses deterministic lexical order when all objectives tie", () => {
    const result = buildJoint21([], { weekday: 6, cutoffDate: "2026-09-05" });
    expect(result.selectedPairs).toEqual([
      "00",
      "01",
      "02",
      "03",
      "04",
      "05",
      "06",
      "07",
      "08",
      "09",
      "11",
      "12",
      "13",
      "14",
      "15",
      "16",
      "17",
      "18",
      "19",
      "22",
      "23",
    ]);
  });
});
