import type { LotteryDefinition } from "./types";

export type CatalogAuditStatus = Record<
  string,
  { status: "supported" | "partial" | "failed"; reason?: string }
>;

export function validateCanonicalLotteryCatalog(catalog: LotteryDefinition[]) {
  const ids = new Set<string>(), slugs = new Set<string>();
  for (const lottery of catalog) {
    if (!lottery.id || ids.has(lottery.id)) throw new Error(`duplicate canonical lottery id: ${lottery.id}`);
    if (!lottery.slug || slugs.has(lottery.slug)) throw new Error(`duplicate canonical lottery slug: ${lottery.slug}`);
    ids.add(lottery.id);
    slugs.add(lottery.slug);
  }
  return catalog;
}

export function getCanonicalSupportedLotteries(
  catalog: LotteryDefinition[],
  audit: CatalogAuditStatus = {},
) {
  return validateCanonicalLotteryCatalog(catalog).filter(
    (lottery) => lottery.isActive !== false && audit[lottery.id]?.status !== "failed",
  );
}
