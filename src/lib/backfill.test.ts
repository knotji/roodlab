import { describe, expect, it } from "vitest";
import { buildBackfillPlan, parseBackfillNumber } from "./backfill";

const catalog = ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase(), slug: id, category: "test", sourceUrl: `https://example.com/${id}` }));

describe("backfill planner", () => {
  it("selects supported and partial missing lotteries while skipping failed and completed", () => {
    const plan = buildBackfillPlan({ catalog, audit: { a:{status:"supported"}, b:{status:"partial"}, c:{status:"failed"}, d:{status:"supported"} }, hydratedIds:["a"], checkpointIds:["d"] });
    expect(plan.items.map((item) => item.id)).toEqual(["b"]);
    expect(plan).toMatchObject({ eligibleCount: 3, hydratedCount: 1, checkpointCount: 1, skippedFailed: 1 });
  });
  it("supports bounded force runs", () => {
    expect(buildBackfillPlan({ catalog, audit:{a:{status:"supported"},b:{status:"supported"},c:{status:"supported"},d:{status:"supported"}}, hydratedIds:["a"], force:true, limit:2 }).items.map((item) => item.id)).toEqual(["a","b"]);
  });
  it("bounds numeric CLI options", () => {
    expect(parseBackfillNumber("3", 2, 1, 4)).toBe(3);
    expect(parseBackfillNumber("20", 2, 1, 4)).toBe(2);
  });
});
