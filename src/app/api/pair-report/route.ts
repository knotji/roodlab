import { NextResponse } from "next/server";
import { readAllSnapshots, readCatalog } from "@/lib/cache";
import {
  PAIR_MODELS,
  summarizePairDiagnostics,
  walkForwardPairDiagnostics,
} from "@/lib/analysis/pair-audit";
import { getCanonicalDataset } from "@/lib/history-provider";
import { readResearchCache, researchCacheHeaders, writeResearchCache } from "@/lib/research-cache";
export async function GET() {
  const snapshots = await readAllSnapshots(),
    catalog = await readCatalog(),
    ids = [
      "goverment",
      "minhngocstar",
      "laosdevelops",
      "nikkei-morning",
      "baac",
    ],
    horizons = [30, 50, 100],
    cacheKey = `pair-report:${ids.map((id) => snapshots[id]?.historyVersion ?? "missing").join(":")}`,
    cached = readResearchCache<Record<string, unknown>>(cacheKey);
  if (cached) return NextResponse.json(cached, { headers: researchCacheHeaders });
  const
    results = ids.flatMap((lotteryId) =>
      horizons.flatMap((horizon) =>
        PAIR_MODELS.map((model) => {
          const data = getCanonicalDataset(snapshots[lotteryId], 30),
            history = data.analysisHistory,
            top = walkForwardPairDiagnostics(
              history,
              "top",
              30,
              horizon,
              model.id,
            ),
            bottom = walkForwardPairDiagnostics(
              history,
              "bottom",
              30,
              horizon,
              model.id,
            );
          return {
            lotteryId,
            name: catalog.find((x) => x.id === lotteryId)?.name ?? lotteryId,
            horizon,
            historyVersion: data.historyVersion,
            modelId: model.id,
            model: model.name,
            top: summarizePairDiagnostics(top),
            bottom: summarizePairDiagnostics(bottom),
          };
        }),
      ),
    ),
    aggregate = PAIR_MODELS.flatMap((model) =>
      horizons.map((horizon) => {
        const rows = results.filter(
            (x) => x.modelId === model.id && x.horizon === horizon,
          ),
          sum = (side: "top" | "bottom") => {
            const total = rows.reduce((n, x) => n + x[side].sampleSize, 0),
              weighted = (key: "top1" | "top4" | "top10" | "top20" | "top50") =>
                rows.reduce((n, x) => n + x[side][key], 0);
            return {
              sampleSize: total,
              top1: weighted("top1"),
              top4: weighted("top4"),
              top10: weighted("top10"),
              top20: weighted("top20"),
              top50: weighted("top50"),
              meanRank: total
                ? Math.round(
                    (rows.reduce(
                      (n, x) => n + x[side].meanRank * x[side].sampleSize,
                      0,
                    ) /
                      total) *
                      10,
                  ) / 10
                : 0,
              averageUnseenPercent: total
                ? Math.round(
                    (rows.reduce(
                      (n, x) =>
                        n + x[side].averageUnseenPercent * x[side].sampleSize,
                      0,
                    ) /
                      total) *
                      10,
                  ) / 10
                : 0,
            };
          };
        return {
          modelId: model.id,
          model: model.name,
          horizon,
          top: sum("top"),
          bottom: sum("bottom"),
        };
      }),
    );
  const payload = {
    ok: true,
    generatedAt: new Date().toISOString(),
    lotteries: ids,
    horizons,
    results,
    aggregate,
  };
  writeResearchCache(cacheKey, payload);
  return NextResponse.json(payload, { headers: researchCacheHeaders });
}
