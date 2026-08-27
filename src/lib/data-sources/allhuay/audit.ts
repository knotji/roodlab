import type { LotteryDefinition } from "../../types";
import {
  buildCanonicalHistory,
  parseAllHuayCurrentResult,
  parseAllHuayHistory,
  verifiedNormalizationRules,
} from "./parser";
import { isCompleteDraw, validateHistoryIntegrity } from "../integrity";
export type SourceTemplate =
  "hero+history" | "history-only" | "partial-hero" | "unsupported-template";
export type CatalogAuditItem = {
  id: string;
  name: string;
  category: string;
  template: SourceTemplate;
  heroDate: string | null;
  historyFirstDate: string | null;
  canonicalFirstDate: string | null;
  completeness: "complete" | "partial" | "none";
  status: "supported" | "partial" | "failed";
  draws: number;
  reason?: string;
};
export type CatalogAuditReport = {
  auditedAt: string;
  total: number;
  supported: number;
  partial: number;
  failed: number;
  templates: Record<SourceTemplate, number>;
  items: CatalogAuditItem[];
};
async function auditOne(lottery: LotteryDefinition): Promise<CatalogAuditItem> {
  const base = {
    id: lottery.id,
    name: lottery.name,
    category: lottery.category,
  };
  try {
    const response = await fetch(lottery.sourceUrl, {
      headers: { "User-Agent": "RoodLab/0.2 catalog-audit" },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      return {
        ...base,
        status: "failed",
        template: "unsupported-template",
        draws: 0,
        heroDate: null,
        historyFirstDate: null,
        canonicalFirstDate: null,
        completeness: "none",
        reason: `HTTP ${response.status}`,
      };
    const html = await response.text(),
      history = parseAllHuayHistory(
        html,
        lottery.id,
        lottery.sourceUrl,
        lottery.normalizationRules,
      ),
      rules = verifiedNormalizationRules(history, lottery.normalizationRules),
      hero = parseAllHuayCurrentResult(html, rules),
      canonical = buildCanonicalHistory(
        hero,
        history,
        lottery.id,
        lottery.sourceUrl,
      ).draws,
      template: SourceTemplate = hero
        ? hero.completeness === "complete"
          ? "hero+history"
          : "partial-hero"
        : history.length
          ? "history-only"
          : "unsupported-template",
      issues = validateHistoryIntegrity(canonical, lottery.id),
      complete = canonical.filter(isCompleteDraw);
    if (!canonical.length)
      return {
        ...base,
        status: "failed",
        template,
        draws: 0,
        heroDate: hero?.drawDate ?? null,
        historyFirstDate: history[0]?.drawDate ?? null,
        canonicalFirstDate: null,
        completeness: "none",
        reason: "no compatible canonical rows",
      };
    if (issues.length)
      return {
        ...base,
        status: "failed",
        template,
        draws: canonical.length,
        heroDate: hero?.drawDate ?? null,
        historyFirstDate: history[0]?.drawDate ?? null,
        canonicalFirstDate: canonical[0]?.drawDate ?? null,
        completeness:
          complete.length === canonical.length ? "complete" : "partial",
        reason: issues[0].reason,
      };
    const status =
      complete.length === canonical.length ? "supported" : "partial";
    return {
      ...base,
      status,
      template,
      draws: canonical.length,
      heroDate: hero?.drawDate ?? null,
      historyFirstDate: history[0]?.drawDate ?? null,
      canonicalFirstDate: canonical[0]?.drawDate ?? null,
      completeness: status === "supported" ? "complete" : "partial",
      reason:
        status === "partial"
          ? `${canonical.length - complete.length} incomplete draws`
          : undefined,
    };
  } catch (error) {
    return {
      ...base,
      status: "failed",
      template: "unsupported-template",
      draws: 0,
      heroDate: null,
      historyFirstDate: null,
      canonicalFirstDate: null,
      completeness: "none",
      reason: error instanceof Error ? error.message : "fetch failed",
    };
  }
}
export async function auditCatalog(
  catalog: LotteryDefinition[],
  concurrency = 8,
): Promise<CatalogAuditReport> {
  const items: CatalogAuditItem[] = [];
  for (let start = 0; start < catalog.length; start += concurrency)
    items.push(
      ...(await Promise.all(
        catalog.slice(start, start + concurrency).map(auditOne),
      )),
    );
  const templates = {
    "hero+history": 0,
    "history-only": 0,
    "partial-hero": 0,
    "unsupported-template": 0,
  } satisfies Record<SourceTemplate, number>;
  for (const item of items) templates[item.template]++;
  return {
    auditedAt: new Date().toISOString(),
    total: items.length,
    supported: items.filter((x) => x.status === "supported").length,
    partial: items.filter((x) => x.status === "partial").length,
    failed: items.filter((x) => x.status === "failed").length,
    templates,
    items,
  };
}
