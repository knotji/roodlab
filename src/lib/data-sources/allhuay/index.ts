import type {
  CanonicalHistoryResult,
  LotteryDataSource,
  LotteryDefinition,
  LotteryDraw,
} from "../../types";
import {
  parseAllHuayHistory,
  parseAllHuayCurrentResult,
  buildCanonicalHistory,
  verifiedNormalizationRules,
} from "./parser";
import { parseAllHuayCatalog } from "./catalog";
const CATALOG_URL = "https://www.allhuay.com/lotto";
async function getHtml(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": "RoodLab/0.2 historical-analysis" },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`AllHuay ตอบกลับ ${res.status}`);
  return res.text();
}
export class AllHuayDataSource implements LotteryDataSource {
  constructor(private readonly cachedCatalog?: LotteryDefinition[]) {}
  async getLotteries(): Promise<LotteryDefinition[]> {
    const catalog = parseAllHuayCatalog(await getHtml(CATALOG_URL));
    if (catalog.length < 100)
      throw new Error(`พบ catalog เพียง ${catalog.length} รายการ`);
    return catalog;
  }
  async getCanonicalHistory(
    lotteryId: string,
    options: { limit?: number } = {},
  ): Promise<CanonicalHistoryResult> {
    const lotteries = this.cachedCatalog?.length
        ? this.cachedCatalog
        : await this.getLotteries(),
      lottery = lotteries.find((x) => x.id === lotteryId);
    if (!lottery) throw new Error("ไม่พบประเภทหวยใน catalog");
    const limit = options.limit ?? 100,
      pages = Math.min(5, Math.max(1, Math.ceil(limit / 20))),
      batches = await Promise.all(
        Array.from({ length: pages }, async (_, i) => {
          const url = i
            ? `${lottery.sourceUrl}/page/${i + 1}`
            : lottery.sourceUrl;
          return { html: await getHtml(url), url };
        }),
      ),
      tableDraws = Array.from(
        new Map(
          batches
            .flatMap((b) =>
              parseAllHuayHistory(b.html, lottery.id, b.url, lottery.normalizationRules),
            )
            .map((x) => [x.id, x]),
        ).values(),
      ),
      rules = verifiedNormalizationRules(tableDraws, lottery.normalizationRules),
      currentResult = parseAllHuayCurrentResult(batches[0].html, rules),
      canonical = buildCanonicalHistory(
        currentResult,
        tableDraws,
        lottery.id,
        lottery.sourceUrl,
      ),
      template: CanonicalHistoryResult["template"] = currentResult
        ? currentResult.completeness === "complete"
          ? "hero+history"
          : "partial-hero"
        : tableDraws.length
          ? "history-only"
          : "unsupported-template";
    return {
      draws: canonical.draws.slice(0, limit),
      currentSourceResultDate: currentResult?.drawDate ?? null,
      conflicts: canonical.conflicts.length,
      template,
    };
  }
  async getHistory(
    lotteryId: string,
    options: { limit?: number } = {},
  ): Promise<LotteryDraw[]> {
    return (await this.getCanonicalHistory(lotteryId, options)).draws;
  }
}
