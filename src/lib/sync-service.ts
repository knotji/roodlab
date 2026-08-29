import { commitCanonicalSync } from "./canonical-history";
import { readCatalog, readSnapshot } from "./cache";
import { AllHuayDataSource } from "./data-sources/allhuay";
import { buildFreshnessInfo, latestDrawDate, mergeDrawHistory } from "./freshness";
import { reconcileProspectiveOutcomes } from "./prospective";

export async function syncLotteryFromSource(lotteryId: string) {
  const existing = await readSnapshot(lotteryId),
    incoming = await new AllHuayDataSource(await readCatalog()).getCanonicalHistory(lotteryId, { limit: 100 }),
    freshness = buildFreshnessInfo({
      sourceLatestDrawDate: incoming.currentSourceResultDate ?? latestDrawDate(incoming.draws),
      cachedLatestDrawDate: latestDrawDate(mergeDrawHistory(existing?.draws ?? [], incoming.draws, 100)),
      sourceReachable: true,
    }),
    result = await commitCanonicalSync({ lotteryId, existing, incoming, freshness });
  let reconciledPredictions = 0;
  try {
    reconciledPredictions = await reconcileProspectiveOutcomes(lotteryId, result.snapshot.draws);
  } catch {}
  return { ...result, freshness, reconciledPredictions };
}

