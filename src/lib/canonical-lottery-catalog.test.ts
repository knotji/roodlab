import { describe, expect, it } from "vitest";
import { getCanonicalSupportedLotteries, validateCanonicalLotteryCatalog } from "./canonical-lottery-catalog";
import type { LotteryDefinition } from "./types";

const lottery = (id: string, name = id): LotteryDefinition => ({ id, slug: id, name, category: "test", sourceUrl: `https://example.com/${id}`, isActive: true });

describe("canonical lottery catalog", () => {
  it("uses stable IDs rather than display names and keeps every supported entry once", () => {
    const catalog = [lottery("alpha", "ชื่อเดียวกัน"), lottery("beta", "ชื่อเดียวกัน")];
    expect(getCanonicalSupportedLotteries(catalog).map((item) => item.id)).toEqual(["alpha", "beta"]);
  });

  it("rejects duplicate canonical IDs and slugs", () => {
    expect(() => validateCanonicalLotteryCatalog([lottery("alpha"), lottery("alpha")])).toThrow(/duplicate canonical lottery id/);
    expect(() => validateCanonicalLotteryCatalog([lottery("alpha"), { ...lottery("beta"), slug: "alpha" }])).toThrow(/duplicate canonical lottery slug/);
  });

  it("excludes disabled and provider-audit failed entries without using performance", () => {
    const catalog = [lottery("alpha"), { ...lottery("beta"), isActive: false }, lottery("gamma")];
    expect(getCanonicalSupportedLotteries(catalog, { gamma: { status: "failed" } }).map((item) => item.id)).toEqual(["alpha"]);
  });
});
