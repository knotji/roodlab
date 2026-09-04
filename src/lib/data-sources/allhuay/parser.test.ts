import { describe, expect, it } from "vitest";
import { parseAllHuayCurrentResult, parseAllHuayHistory, parseAllHuayProviderResultStatus } from "./parser";

describe("AllHuay parser", () => {
  it("parses exact provider suspension separately from partial and malformed values", () => {
    expect(parseAllHuayProviderResultStatus(["งด", " งด ", "งด"])).toEqual({ status: "suspended", raw: "งด" });
    expect(parseAllHuayProviderResultStatus(["งด", "งด"])).toEqual({ status: "suspended", raw: "งด" });
    expect(parseAllHuayProviderResultStatus(["123", "23", "07"])).toEqual({ status: "normal" });
    expect(parseAllHuayProviderResultStatus(["123", "", "07"])).toEqual({ status: "unknown" });
    expect(parseAllHuayProviderResultStatus(["งด 12", "งด"])).toEqual({ status: "unknown" });
    const hero = (values: [string, string, string]) => `<section id="lotto-latest-results"><div class="result-container"><h1 class="result-header-title">2026-09-03</h1>${[["3 ตัวบน",values[0]],["2 ตัวบน",values[1]],["2 ตัวล่าง",values[2]]].map(([label,value])=>`<div class="result-item"><span class="result-item-label">${label}</span><span class="result-item-value">${value}</span></div>`).join("")}</div></section>`;
    expect(parseAllHuayCurrentResult(hero(["งด", "งด", "งด"]))).toMatchObject({ completeness: "partial", providerResultStatus: "suspended", providerStatusRaw: "งด" });
    expect(parseAllHuayCurrentResult(hero(["123", "23", "07"]))).toMatchObject({ completeness: "complete", providerResultStatus: "normal", top2: "23", bottom2: "07" });
    expect(parseAllHuayCurrentResult(hero(["123", "", "07"]))).toMatchObject({ completeness: "partial", providerResultStatus: "unknown" });
  });

  it("retains explicit suspended history rows as non-complete provenance", () => {
    const html = `<table><tr><th>งวดวันที่</th><th>รางวัลที่ 1</th><th>3 ตัวบน</th><th>2 ตัวบน</th><th>2 ตัวล่าง</th></tr><tr><td>3 กันยายน 2569</td><td>งด</td><td>งด</td><td>งด</td><td>งด</td></tr></table>`;
    expect(parseAllHuayHistory(html, "demo", "https://example.com")[0]).toMatchObject({ completeness: "partial", providerResultStatus: "suspended", providerStatusRaw: "งด" });
  });
  it("parses observed history table and preserves zeroes", () => {
    const html = `<table><tr><th>งวดวันที่</th><th>รางวัลที่ 1</th><th>3 ตัวบน</th><th>2 ตัวบน</th><th>2 ตัวล่าง</th></tr><tr><td>Draw August 16, 2026</td><td>40062</td><td>062</td><td>62</td><td>02</td></tr><tr><td>16 สิงหาคม 2569</td><td>40062</td><td>062</td><td>62</td><td>02</td></tr></table>`;
    const draws = parseAllHuayHistory(html, "hanoi-vip", "https://example.com");
    expect(draws).toHaveLength(1);
    expect(draws[0]).toMatchObject({
      drawDate: "2026-08-16",
      top3: "062",
      top2: "62",
      bottom2: "02",
    });
  });

  it("keeps the newest row when source uses งวด prefix", () => {
    const html = `<table><tr><th>งวดวันที่</th><th>3 ตัวบน</th><th>2 ตัวบน</th><th>2 ตัวล่าง</th></tr><tr><td>งวด 26 สิงหาคม 2569</td><td>240</td><td>40</td><td>51</td></tr><tr><td>งวด 25 สิงหาคม 2569</td><td>896</td><td>96</td><td>94</td></tr></table>`;
    const draws = parseAllHuayHistory(
      html,
      "nikkei-vip-morning",
      "https://example.com",
    );
    expect(draws.map((draw) => draw.drawDate)).toEqual([
      "2026-08-26",
      "2026-08-25",
    ]);
  });

  it("converts Buddhist Era dates with abbreviated months", () => {
    const html = `<table><tr><th>งวดวันที่</th><th>3 ตัวบน</th><th>2 ตัวบน</th><th>2 ตัวล่าง</th></tr><tr><td>26 ส.ค. 2569</td><td>240</td><td>40</td><td>51</td></tr></table>`;
    const draws = parseAllHuayHistory(
      html,
      "nikkei-vip-morning",
      "https://example.com",
    );
    expect(draws[0]?.drawDate).toBe("2026-08-26");
  });

  it("normalizes reversed source ordering to deduplicated rows", () => {
    const html = `<table><tr><th>งวดวันที่</th><th>3 ตัวบน</th><th>2 ตัวบน</th><th>2 ตัวล่าง</th></tr><tr><td>24 สิงหาคม 2569</td><td>951</td><td>51</td><td>70</td></tr><tr><td>26 สิงหาคม 2569</td><td>240</td><td>40</td><td>51</td></tr><tr><td>25 สิงหาคม 2569</td><td>896</td><td>96</td><td>94</td></tr></table>`;
    const draws = parseAllHuayHistory(
      html,
      "nikkei-vip-morning",
      "https://example.com",
    ).sort((a, b) => b.drawDate.localeCompare(a.drawDate));
    expect(draws.map((draw) => draw.drawDate)).toEqual([
      "2026-08-26",
      "2026-08-25",
      "2026-08-24",
    ]);
  });

  it("deduplicates duplicate draw rows with the same date", () => {
    const html = `<table><tr><th>งวดวันที่</th><th>3 ตัวบน</th><th>2 ตัวบน</th><th>2 ตัวล่าง</th></tr><tr><td>25 สิงหาคม 2569</td><td>896</td><td>96</td><td>94</td></tr><tr><td>25 สิงหาคม 2569</td><td>896</td><td>96</td><td>94</td></tr></table>`;
    const draws = parseAllHuayHistory(
      html,
      "nikkei-vip-morning",
      "https://example.com",
    );
    expect(draws).toHaveLength(1);
  });
});
