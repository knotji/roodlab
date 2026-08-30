import { NextResponse } from "next/server";
import { readAllSnapshots, readCatalog } from "@/lib/cache";
import { compareAlgorithms } from "@/lib/analysis/formula-lab";
import { getCanonicalDataset } from "@/lib/history-provider";
import { readResearchCache, researchCacheHeaders, writeResearchCache } from "@/lib/research-cache";
export async function GET() {
  const snapshots = await readAllSnapshots(),
    catalog = await readCatalog(),
    ids = [
      "goverment",
      "baac",
      "minhngocstar",
      "laosdevelops",
      "nikkei-morning",
    ],
    cacheKey = `formula-report:${ids.map((id) => snapshots[id]?.historyVersion ?? "missing").join(":")}`,
    cached = readResearchCache<Record<string, unknown>>(cacheKey);
  if (cached) return NextResponse.json(cached, { headers: researchCacheHeaders });
  const
    results = ids.flatMap((id) => {
      const snapshot = snapshots[id];
      if (!snapshot) return [];
      const data = getCanonicalDataset(snapshot, 30);
      return [30, 50, 100].map((horizon) => ({
        lotteryId: id,
        name: catalog.find((x) => x.id === id)?.name ?? id,
        horizon,
        historyVersion: data.historyVersion,
        analysisCutoff: data.integrity.latestCompleteDrawDate,
        results: compareAlgorithms(data.analysisHistory, 30, horizon),
      }));
    });
  const payload = {
    ok: true,
    generatedAt: new Date().toISOString(),
    results,
  };
  writeResearchCache(cacheKey, payload);
  return NextResponse.json(payload, { headers: researchCacheHeaders });
}
