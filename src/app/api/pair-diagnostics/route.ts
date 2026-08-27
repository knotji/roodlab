import { NextResponse } from "next/server";
import { readAllSnapshots } from "@/lib/cache";
import {
  summarizePairDiagnostics,
  walkForwardPairDiagnostics,
} from "@/lib/analysis/pair-audit";
import { getCanonicalDataset } from "@/lib/history-provider";
export async function GET() {
  const snapshots = await readAllSnapshots(),
    ids = [
      "goverment",
      "minhngocstar",
      "laosdevelops",
      "nikkei-morning",
      "baac",
    ],
    results = ids.map((lotteryId) => {
      const data = getCanonicalDataset(snapshots[lotteryId], 30),
        history = data.analysisHistory,
        side = (value: "top" | "bottom") => {
          const rows = walkForwardPairDiagnostics(
            history,
            value,
            30,
            30,
            "current",
          );
          return {
            summary: summarizePairDiagnostics(rows),
            rows: [...rows].reverse(),
          };
        };
      return { lotteryId, historyVersion: data.historyVersion, top: side("top"), bottom: side("bottom") };
    });
  return NextResponse.json({ ok: true, results });
}
