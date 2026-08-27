import { readCatalog, readSnapshot } from "../../cache";
import {
  buildFreshnessInfo,
  latestDrawDate,
  type FreshnessInfo,
} from "../../freshness";
import { parseAllHuayHistory, parseAllHuayCurrentResult, buildCanonicalHistory, verifiedNormalizationRules } from "./parser";

async function fetchSourcePage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "RoodLab/0.2 freshness-check" },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`AllHuay ตอบกลับ ${res.status}`);
  return res.text();
}

export async function checkLotteryFreshness(
  lotteryId: string,
): Promise<FreshnessInfo> {
  const catalog = await readCatalog();
  const lottery = catalog.find((item) => item.id === lotteryId);
  const snapshot = await readSnapshot(lotteryId);
  const cachedLatestDrawDate = latestDrawDate(snapshot?.draws ?? []);

  if (!lottery) {
    return buildFreshnessInfo({
      sourceLatestDrawDate: null,
      cachedLatestDrawDate,
      sourceReachable: false,
    });
  }

  try {
    const html = await fetchSourcePage(lottery.sourceUrl);
    const tableDraws = parseAllHuayHistory(html, lottery.id, lottery.sourceUrl, lottery.normalizationRules);
    const currentResult = parseAllHuayCurrentResult(html, verifiedNormalizationRules(tableDraws, lottery.normalizationRules));
    const { draws: canonical } = buildCanonicalHistory(
      currentResult,
      tableDraws,
      lottery.id,
      lottery.sourceUrl,
    );
    const sourceLatestDrawDate = latestDrawDate(canonical);

    // Track partial hero date separately if it's newer than the canonical latest
    const currentSourceResultDate =
      currentResult && currentResult.completeness === "partial"
        ? currentResult.drawDate
        : undefined;

    return buildFreshnessInfo({
      sourceLatestDrawDate,
      cachedLatestDrawDate,
      sourceReachable: true,
      currentSourceResultDate,
    });
  } catch {
    return buildFreshnessInfo({
      sourceLatestDrawDate: null,
      cachedLatestDrawDate,
      sourceReachable: false,
    });
  }
}
