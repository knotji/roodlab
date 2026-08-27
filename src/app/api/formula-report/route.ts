import { NextResponse } from "next/server";
import { readAllSnapshots, readCatalog } from "@/lib/cache";
import { compareAlgorithms } from "@/lib/analysis/formula-lab";
import { getCanonicalDataset } from "@/lib/history-provider";
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
  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    results,
  });
}
