type Entry = { expiresAt: number; value: unknown };

const reports = new Map<string, Entry>();

export function readResearchCache<T>(key: string): T | null {
  const entry = reports.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    reports.delete(key);
    return null;
  }
  return entry.value as T;
}

export function writeResearchCache<T>(key: string, value: T, ttlMs = 5 * 60_000): T {
  reports.set(key, { value, expiresAt: Date.now() + ttlMs });
  if (reports.size > 30) reports.delete(reports.keys().next().value!);
  return value;
}

export const researchCacheHeaders = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
};
