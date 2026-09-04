import { commitCanonicalSync } from "./canonical-history";
import { readCatalog, readSnapshot } from "./cache";
import { AllHuayDataSource } from "./data-sources/allhuay";
import { buildFreshnessInfo, latestDrawDate, mergeDrawHistory } from "./freshness";
import { reconcileProspectiveOutcomes } from "./prospective";

export async function syncLotteryFromSource(lotteryId: string, options: { reconcileProspective?: boolean } = {}) {
  const [existing, catalog] = await Promise.all([readSnapshot(lotteryId), readCatalog()]),
    incoming = await new AllHuayDataSource(catalog).getCanonicalHistory(lotteryId, {
      // Existing history is merged safely below, so routine sync only needs the
      // newest two source pages. A first sync still hydrates the full window.
      limit: existing?.draws.length ? 40 : 100,
    }),
    freshness = buildFreshnessInfo({
      sourceLatestDrawDate: incoming.currentSourceResultDate ?? latestDrawDate(incoming.draws),
      cachedLatestDrawDate: latestDrawDate(mergeDrawHistory(existing?.draws ?? [], incoming.draws, 100)),
      sourceReachable: true,
    }),
    result = await commitCanonicalSync({ lotteryId, existing, incoming, freshness });
  let reconciledPredictions = 0;
  try {
    if (!result.addedDraws || options.reconcileProspective === false) return { ...result, freshness, reconciledPredictions };
    reconciledPredictions = await reconcileProspectiveOutcomes(lotteryId, result.snapshot.draws);
  } catch {}
  return { ...result, freshness, reconciledPredictions };
}
