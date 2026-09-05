import type { DayPattern } from "./day-pattern";

export type LotteryId = string;

export type PlayedUniverseWeekday = Exclude<DayPattern, "all">;

export type PlayedUniverseByWeekday = Record<PlayedUniverseWeekday, readonly LotteryId[]>;

/**
 * Operational alias -> canonical id mappings, one weekday group at a time, sourced
 * from an explicit user-provided played-lottery list (never inferred from historical
 * results). Canonical ids are resolved against `data/lotteries.json`. Keeping the
 * alias table alongside the resolved list preserves the mapping for audit/traceability.
 */
const SATURDAY_PLAYED_ALIASES: readonly { name: string; id: LotteryId }[] = [
  { name: "นิเคอิเช้า VIP", id: "nikkei-vip-morning" },
  { name: "ฮานอยอาเซียน", id: "hanoiasean" },
  { name: "จีนเช้า VIP", id: "szse-vip-morning" },
  { name: "ดาวโจนส์", id: "dji" },
  { name: "ฮั่งเส็งเช้า VIP", id: "hsi-vip-morning" },
  { name: "ฮานอย HD", id: "xosohd" },
  { name: "ไต้หวัน VIP", id: "twse-vip" },
  { name: "ฮานอย STAR", id: "minhngocstar" },
  { name: "ฮานอย สตาร์", id: "minhngocstar" },
  { name: "เกาหลี VIP", id: "ktop30-vip" },
  { name: "นิเคอิบ่าย VIP", id: "nikkei-vip-afternoon" },
  { name: "ลาว HD", id: "laoshd" },
  { name: "ฮานอย TV", id: "minhngoctv" },
  { name: "จีนบ่าย VIP", id: "szse-vip-afternoon" },
  { name: "ฮั่งเส็งบ่าย VIP", id: "hsi-vip-afternoon" },
  { name: "ลาวสตาร์", id: "laostars" },
  { name: "ฮานอยกาชาด", id: "xosoredcross" },
  { name: "ลาวสามัคคี", id: "laounion" },
  { name: "ลาวอาเซียน", id: "laosasean" },
  { name: "ลาว VIP", id: "laosvip" },
  { name: "ลาวสามัคคี VIP", id: "laounionvip" },
  { name: "ลาวกาชาด", id: "laoredcross" },
  { name: "อังกฤษ VIP", id: "england-vip" },
  { name: "ฮานอย EXTRA", id: "xosoextra" },
  { name: "เยอรมัน VIP", id: "germany-vip" },
  { name: "ดาวโจนส์ STAR", id: "dowjonestar" },
];

/**
 * Monday-Friday operational list, resolved from the user-provided "รายการหวยวันนี้"
 * schedule (2026-09-05). Four displayed names could not be matched to any canonical
 * catalog entry and are deliberately excluded rather than guessed - see
 * `UNRESOLVED_WEEKDAY_ALIASES` below. They must be added here explicitly once a
 * canonical id is confirmed, never inferred from performance.
 */
const WEEKDAY_PLAYED_ALIASES: readonly { name: string; id: LotteryId }[] = [
  // Morning
  { name: "นิเคอิเช้า VIP", id: "nikkei-vip-morning" },
  { name: "ฮานอยอาเซียน", id: "hanoiasean" },
  { name: "จีนเช้า VIP", id: "szse-vip-morning" },
  { name: "จีนเช้า", id: "szse-morning" },
  { name: "ลาว TV", id: "laotv" },
  { name: "ฮั่งเส็งเช้า", id: "hsi-morning" },
  { name: "ฮานอย HD", id: "xosohd" },
  { name: "ไต้หวัน VIP", id: "twse-vip" },
  { name: "ฮานอยสตาร์", id: "minhngocstar" },
  { name: "ไต้หวัน", id: "twse" },
  // Afternoon
  { name: "เกาหลีบ่าย VIP", id: "ktop30-vip" },
  { name: "นิเคอิบ่าย", id: "nikkei-afternoon" },
  { name: "นิเคอิบ่าย VIP", id: "nikkei-vip-afternoon" },
  { name: "ลาว HD", id: "laoshd" },
  { name: "จีนบ่าย", id: "szse-afternoon" },
  { name: "ฮานอย TV", id: "minhngoctv" },
  { name: "จีนบ่าย VIP", id: "szse-vip-afternoon" },
  { name: "ฮั่งเส็งบ่าย VIP", id: "hsi-vip-afternoon" },
  { name: "ลาวสตาร์", id: "laostars" },
  { name: "สิงคโปร์", id: "sgx" },
  { name: "ไทยเย็น", id: "set" },
  // Night
  { name: "ลาวสามัคคี", id: "laounion" },
  { name: "ลาวอาเซียน", id: "laosasean" },
  { name: "ลาว VIP", id: "laosvip" },
  { name: "ลาวสามัคคี VIP", id: "laounionvip" },
  { name: "ลาวกาชาด", id: "laoredcross" },
  { name: "อังกฤษ VIP", id: "england-vip" },
  { name: "รัสเซีย", id: "moexbc" },
  { name: "ฮานอย EXTRA", id: "xosoextra" },
  { name: "เยอรมัน", id: "gdaxi" },
  { name: "อังกฤษ", id: "ftse100" },
  { name: "เยอรมัน VIP", id: "germany-vip" },
  { name: "ฮานอยกาชาด", id: "xosoredcross" },
  { name: "ฮานอย VIP", id: "mlnhngo" },
  { name: "ลาวพัฒนา", id: "laosdevelops" },
  { name: "ดาวโจนส์", id: "dji" },
  { name: "ดาวโจนส์ STAR", id: "dowjonestar" },
];

/**
 * Names from the Monday-Friday "รายการหวยวันนี้" schedule with no match anywhere in
 * the canonical catalog. Checked twice against the sole upstream provider this repo
 * integrates with (`AllHuayDataSource`, `src/lib/data-sources/allhuay`):
 *
 * 1. Against the cached catalog (`data/lotteries.json`, 151 entries) - no match.
 * 2. Against a live fetch of https://www.allhuay.com/lotto on 2026-09-05 - identical
 *    151/151 ids to the cache (zero additions, zero removals), still no match. This
 *    rules out a stale local cache as the explanation: AllHuay genuinely does not
 *    currently offer these products under any name or slug.
 *
 * Per the zero-silent-guess rule, these stay excluded from `WEEKDAY_PLAYED_ALIASES`
 * rather than mapped to a similarly-named but different source - in particular,
 * "ฮ่องกง VIP" is deliberately NOT aliased to `hongkong-visa` or `hkindex-st`: both
 * exist upstream, but neither's provider identity (VISA / ST product tier) has been
 * shown to be the same lottery as a plain "VIP" tier. Move an entry into
 * `WEEKDAY_PLAYED_ALIASES` only once AllHuay lists it, or once RoodLab integrates a
 * second provider that carries it, through the normal canonical catalog pipeline.
 */
export const UNRESOLVED_WEEKDAY_ALIASES: readonly { name: string; reason: string }[] = [
  { name: "ปักกิ่งเช้า", reason: "no Beijing morning index on AllHuay (cache and live catalog both checked, 151/151 identical)" },
  { name: "ปักกิ่งบ่าย", reason: "no Beijing afternoon index on AllHuay (cache and live catalog both checked, 151/151 identical)" },
  { name: "อินโดนีเซีย", reason: "no Indonesia source on AllHuay (cache and live catalog both checked, 151/151 identical)" },
  { name: "ฮ่องกง VIP", reason: "AllHuay has hongkong-visa and hkindex-st, but no plain Hong Kong VIP entry, and provider identity with either is unconfirmed" },
];

/** Weekday -> operational alias table. Only weekday groups with a real user-provided list are present here. */
const PLAYED_ALIASES_BY_WEEKDAY: Partial<Record<PlayedUniverseWeekday, readonly { name: string; id: LotteryId }[]>> = {
  1: WEEKDAY_PLAYED_ALIASES,
  2: WEEKDAY_PLAYED_ALIASES,
  3: WEEKDAY_PLAYED_ALIASES,
  4: WEEKDAY_PLAYED_ALIASES,
  5: WEEKDAY_PLAYED_ALIASES,
  6: SATURDAY_PLAYED_ALIASES,
};

function dedupeIds(aliases: readonly { name: string; id: LotteryId }[]): readonly LotteryId[] {
  return [...new Set(aliases.map((alias) => alias.id))];
}

const WEEKDAY_PLAYED_SOURCE_IDS = dedupeIds(WEEKDAY_PLAYED_ALIASES);
const SATURDAY_PLAYED_SOURCE_IDS = dedupeIds(SATURDAY_PLAYED_ALIASES);

/**
 * Weekday-keyed operational "Played Universe": lotteries actually played on each
 * weekday, independent of historical result performance. Keyed with the same
 * weekday convention as `drawWeekday()` / `DayPattern` (0 = Sunday ... 6 = Saturday).
 *
 * Monday-Friday share one operational list (the "รายการหวยวันนี้" schedule provided
 * 2026-09-05). Saturday keeps its own previously-accepted 25-source list, unchanged
 * by this migration. Sunday is intentionally left empty - it has no equivalent
 * operational list yet, and production must fall back to Dynamic All Eligible for it
 * (see `resolveProductionGlobalUniverse` in `global-universe.ts`) rather than treat an
 * empty list as "zero eligible sources".
 */
export const PLAYED_UNIVERSE_BY_WEEKDAY: PlayedUniverseByWeekday = {
  0: [],
  1: WEEKDAY_PLAYED_SOURCE_IDS,
  2: WEEKDAY_PLAYED_SOURCE_IDS,
  3: WEEKDAY_PLAYED_SOURCE_IDS,
  4: WEEKDAY_PLAYED_SOURCE_IDS,
  5: WEEKDAY_PLAYED_SOURCE_IDS,
  6: SATURDAY_PLAYED_SOURCE_IDS,
};

export function playedUniverseAliasesForWeekday(weekday: PlayedUniverseWeekday) {
  return PLAYED_ALIASES_BY_WEEKDAY[weekday] ?? [];
}

export function resolvePlayedUniverseSourceIds(weekday: PlayedUniverseWeekday): readonly LotteryId[] {
  return PLAYED_UNIVERSE_BY_WEEKDAY[weekday];
}
