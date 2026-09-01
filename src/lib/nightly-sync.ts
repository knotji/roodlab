import { readCatalog, readCatalogAudit } from "./cache";
import { hasDatabase } from "./database";
import { readDocument, writeDocument } from "./postgres-storage";

const CURSOR_KEY = "nightly-sync-cursor-v1";

export function rotatingCoverageIds(eligible: string[], due: string[], cursor: number, limit: number) {
  const ordered = [...new Set(eligible)].sort(), selected = [...new Set(due)].slice(0, limit);
  if (!ordered.length || selected.length >= limit) return { ids: selected, nextCursor: 0 };
  let scanned = 0, index = ((cursor % ordered.length) + ordered.length) % ordered.length;
  while (selected.length < limit && scanned < ordered.length) {
    const id = ordered[index];
    if (!selected.includes(id)) selected.push(id);
    index = (index + 1) % ordered.length;
    scanned += 1;
  }
  return { ids: selected, nextCursor: index };
}

export async function buildNightlySyncBatch(due: string[], limit = 12) {
  const [catalog, audit] = await Promise.all([readCatalog(), readCatalogAudit()]),
    eligible = catalog.filter((item) => item.isActive !== false && audit[item.id]?.status !== "failed").map((item) => item.id);
  let cursor = 0;
  if (hasDatabase()) {
    const stored = await readDocument(CURSOR_KEY).catch(() => null) as { cursor?: number } | null;
    cursor = Number.isInteger(stored?.cursor) ? stored!.cursor! : 0;
  }
  const batch = rotatingCoverageIds(eligible, due, cursor, limit);
  if (hasDatabase()) await writeDocument(CURSOR_KEY, { cursor: batch.nextCursor, eligibleCount: eligible.length, updatedAt: new Date().toISOString() });
  return { ...batch, eligibleCount: eligible.length, dueCount: due.length };
}
