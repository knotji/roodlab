import { readAllSnapshots } from "../src/lib/cache";
import { getCanonicalDataset } from "../src/lib/history-provider";
import {
  PAIR_MODELS,
  walkForwardPairDiagnostics,
} from "../src/lib/analysis/pair-audit";
const snapshots = await readAllSnapshots(),
  eligible = Object.values(snapshots)
    .map((snapshot) => ({
      id: snapshot.lotteryId,
      history: [...getCanonicalDataset(snapshot, 1000).analysisHistory].sort(
        (a, b) => a.drawDate.localeCompare(b.drawDate),
      ),
    }))
    .filter((x) => x.history.length >= 80),
  result = PAIR_MODELS.map((model) => {
    const ranks = eligible.flatMap((x) => {
      const end = Math.floor(x.history.length * 0.75),
        development = x.history.slice(0, end);
      return (["top", "bottom"] as const).flatMap((side) =>
        walkForwardPairDiagnostics(
          development,
          side,
          30,
          Number.MAX_SAFE_INTEGER,
          model.id,
        ).map((r) => r.actualRank),
      );
    });
    const inside = (n: number) =>
        ranks.filter((x) => x <= n).length / ranks.length,
      sorted = [...ranks].sort((a, b) => a - b);
    return {
      id: model.id,
      name: model.name,
      n: ranks.length,
      top4: inside(4),
      top10: inside(10),
      top20: inside(20),
      medianRank: sorted[Math.floor(sorted.length / 2)],
      meanRank: ranks.reduce((a, b) => a + b, 0) / ranks.length,
      mrr: ranks.reduce((a, b) => a + 1 / b, 0) / ranks.length,
    };
  }).sort((a, b) => b.top10 - a.top10);
console.log(JSON.stringify(result, null, 2));
