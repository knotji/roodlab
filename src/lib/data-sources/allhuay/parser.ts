import * as cheerio from "cheerio";
import {
  LotteryDrawSchema,
  type LotteryDraw,
  type LotteryNormalizationRules,
} from "../../types";

const thaiMonths: Record<string, string> = {
  "ม.ค.": "01",
  มกราคม: "01",
  "ก.พ.": "02",
  กุมภาพันธ์: "02",
  "มี.ค.": "03",
  มีนาคม: "03",
  "เม.ย.": "04",
  เมษายน: "04",
  "พ.ค.": "05",
  พฤษภาคม: "05",
  "มิ.ย.": "06",
  มิถุนายน: "06",
  "ก.ค.": "07",
  กรกฎาคม: "07",
  "ส.ค.": "08",
  สิงหาคม: "08",
  "ก.ย.": "09",
  กันยายน: "09",
  "ต.ค.": "10",
  ตุลาคม: "10",
  "พ.ย.": "11",
  พฤศจิกายน: "11",
  "ธ.ค.": "12",
  ธันวาคม: "12",
};

/** Exported for testing. Handles ISO, Thai full months, abbreviated months, งวด prefix, and Buddhist Era. */
export function parseDate(text: string): string | null {
  const iso = text.match(/(20\d{2})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const m = text
    .replace(/^งวด\s+/u, "")
    .match(/(\d{1,2})\s+([ก-๙.]+)\s+(25\d{2})/);
  if (!m || !thaiMonths[m[2]]) return null;
  return `${Number(m[3]) - 543}-${thaiMonths[m[2]]}-${m[1].padStart(2, "0")}`;
}

export function parseAllHuayHistory(
  html: string,
  lotteryId: string,
  sourceUrl: string,
  rules?: LotteryNormalizationRules,
): LotteryDraw[] {
  const $ = cheerio.load(html);
  const rows: LotteryDraw[] = [];
  $("table tr").each((_, tr) => {
    const cells = $(tr)
      .find("th,td")
      .map((__, el) => $(el).text().replace(/\s+/g, " ").trim())
      .get();
    if (cells.length < 4) return;
    const date = parseDate(cells[0]);
    if (!date) return;
    const numeric = cells
      .slice(1)
      .map((x) => x.match(/\b\d{2,5}\b/)?.[0])
      .filter(Boolean) as string[];
    const top3 = numeric.find((x) => x.length === 3);
    const twos = numeric.filter((x) => x.length === 2);
    const explicitTop2 = twos[0],
      top2 =
        explicitTop2 ??
        (rules?.deriveTop2FromTop3 ? top3?.slice(-2) : undefined),
      bottom2 = twos.length > 1 ? twos.at(-1) : undefined;
    const candidate = {
      id: `${lotteryId}-${date}`,
      lotteryId,
      drawDate: date,
      top3,
      top2,
      bottom2,
      sourceUrl,
      source: "historical-table" as const,
      completeness:
        top3 && top2 && bottom2 ? ("complete" as const) : ("partial" as const),
    };
    const parsed = LotteryDrawSchema.safeParse(candidate);
    if (parsed.success) rows.push(parsed.data);
  });
  return Array.from(new Map(rows.map((x) => [x.id, x])).values());
}

// ---------------------------------------------------------------------------
// Current-result hero parser
// ---------------------------------------------------------------------------

export type ParsedCurrentResult = {
  drawDate: string;
  top3?: string;
  top2?: string;
  bottom2?: string;
  completeness: "complete" | "partial";
};

export function verifiedNormalizationRules(
  historicalDraws: LotteryDraw[],
  configured?: LotteryNormalizationRules,
): LotteryNormalizationRules {
  if (configured) return configured;
  const comparable = historicalDraws.filter((draw) => draw.top3 && draw.top2);
  return {
    deriveTop2FromTop3:
      comparable.length >= 3 &&
      comparable.every((draw) => draw.top2 === draw.top3!.slice(-2)),
  };
}

const labelMap: Record<string, "top3" | "top2" | "bottom2"> = {
  "3 ตัวบน": "top3",
  "2 ตัวบน": "top2",
  "2 ตัวล่าง": "bottom2",
};

/**
 * Parse the current-result hero area (#lotto-latest-results .result-container).
 * Returns null if the hero section is absent or cannot be parsed.
 */
export function parseAllHuayCurrentResult(
  html: string,
  rules?: LotteryNormalizationRules,
): ParsedCurrentResult | null {
  const $ = cheerio.load(html);
  const container = $("#lotto-latest-results .result-container").first();
  if (!container.length) return null;

  // Date from h1.result-header-title — e.g. "ตรวจหวย หุ้นจีน VIP เช้า งวด 26 สิงหาคม 2569"
  const titleText = container
    .find("h1.result-header-title")
    .first()
    .text()
    .trim();
  const dateMatch = titleText.match(/งวด\s+(.+)/u);
  const drawDate = dateMatch ? parseDate(dateMatch[1]) : parseDate(titleText);
  if (!drawDate) return null;

  // Numbers from .result-item-value paired with .result-item-label
  const fields: Partial<Record<"top3" | "top2" | "bottom2", string>> = {};
  container.find(".result-item").each((_, el) => {
    const label = $(el)
      .find(".result-item-label")
      .text()
      .replace(/\s+/g, " ")
      .trim();
    const value = $(el)
      .find(".result-item-value")
      .text()
      .replace(/\s+/g, "")
      .trim();
    const key = labelMap[label];
    if (key && /^\d{2,3}$/.test(value)) {
      fields[key] = value;
    }
  });

  // Derive top2 from top3 when top2 is absent but top3 is present.
  // Documented derivation rule: AllHuay's own historical table confirms
  // top2 = last two digits of top3 for all supported lottery types.
  if (rules?.deriveTop2FromTop3 && fields.top3 && !fields.top2) {
    fields.top2 = fields.top3.slice(-2);
  }

  // Completeness: "complete" requires at least top3 (top2 derived above).
  const completeness =
    fields.top3 && fields.top2 && fields.bottom2 ? "complete" : "partial";

  return { drawDate, ...fields, completeness };
}

// ---------------------------------------------------------------------------
// Canonical history builder
// ---------------------------------------------------------------------------

export type SourceConflict = {
  lotteryId: string;
  drawDate: string;
  heroValues: Partial<Pick<LotteryDraw, "top3" | "top2" | "bottom2">>;
  tableValues: Partial<Pick<LotteryDraw, "top3" | "top2" | "bottom2">>;
};

/**
 * Merge the current-result hero with the historical table into one
 * deduplicated, validated, newest-first canonical history.
 *
 * If both sources contain the same drawDate with different values,
 * the hero values win (they are AllHuay's latest source of truth)
 * and a conflict record is returned for logging.
 */
export function buildCanonicalHistory(
  currentResult: ParsedCurrentResult | null,
  historicalDraws: LotteryDraw[],
  lotteryId: string,
  sourceUrl: string,
): { draws: LotteryDraw[]; conflicts: SourceConflict[] } {
  const conflicts: SourceConflict[] = [];

  // Start with the historical draws indexed by drawDate
  const drawMap = new Map<string, LotteryDraw>();
  for (const draw of historicalDraws) {
    drawMap.set(draw.drawDate, draw);
  }

  // Keep a valid partial hero in canonical history for provenance/UI, while
  // analysis consumers exclude it through the integrity contract.
  if (currentResult) {
    const candidate: Record<string, unknown> = {
      id: `${lotteryId}-${currentResult.drawDate}`,
      lotteryId,
      drawDate: currentResult.drawDate,
      top3: currentResult.top3,
      top2: currentResult.top2,
      bottom2: currentResult.bottom2,
      sourceUrl,
      source: "current-result",
      completeness: currentResult.completeness,
    };

    const parsed = LotteryDrawSchema.safeParse(candidate);
    if (parsed.success) {
      const heroDraw = parsed.data;
      const existing = drawMap.get(heroDraw.drawDate);

      if (existing) {
        // Check for value conflicts
        const heroVals = {
          top3: heroDraw.top3,
          top2: heroDraw.top2,
          bottom2: heroDraw.bottom2,
        };
        const tableVals = {
          top3: existing.top3,
          top2: existing.top2,
          bottom2: existing.bottom2,
        };
        const hasConflict =
          heroVals.top3 !== tableVals.top3 ||
          heroVals.top2 !== tableVals.top2 ||
          heroVals.bottom2 !== tableVals.bottom2;

        if (hasConflict) {
          conflicts.push({
            lotteryId,
            drawDate: heroDraw.drawDate,
            heroValues: heroVals,
            tableValues: tableVals,
          });
        }
      }

      // Hero wins (upsert)
      drawMap.set(heroDraw.drawDate, heroDraw);
    }
  }

  const draws = Array.from(drawMap.values()).sort((a, b) =>
    b.drawDate.localeCompare(a.drawDate),
  );

  return { draws, conflicts };
}
