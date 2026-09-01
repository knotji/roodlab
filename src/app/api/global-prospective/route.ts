import { listGlobalProspective } from "@/lib/global-prospective";

export async function GET() {
  try {
    const records = await listGlobalProspective(), sizes = [5, 6, 7],
      scorecard = Object.fromEntries(sizes.map((size) => {
        let outcomes = 0, topHits = 0, bottomHits = 0;
        for (const raw of records as Record<string, unknown>[]) {
          const digits = (raw.ranked_digits as string[]).slice(0, size), set = new Set(digits);
          for (const item of raw.outcomes as { outcome: { top2?: string; bottom2?: string } }[]) {
            const covered = (pair?: string) => Boolean(pair && pair.length === 2 && set.has(pair[0]) && set.has(pair[1]));
            outcomes += 1; topHits += Number(covered(item.outcome.top2)); bottomHits += Number(covered(item.outcome.bottom2));
          }
        }
        return [size, { outcomes, sidePairRate: outcomes ? (topHits + bottomHits) / (2 * outcomes) : null, topHits, bottomHits }];
      }));
    return Response.json({ ok: true, scorecard, records });
  }
  catch (error) { return Response.json({ ok: false, error: error instanceof Error ? error.message : "อ่านหลักฐานวินรวมไม่สำเร็จ" }, { status: 503 }); }
}
