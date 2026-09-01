export const GLOBAL_DAILY_SOURCE_IDS = [
  "nikkei-vip-morning", "hanoiasean", "nikkei-morning", "szse-vip-morning", "szse-morning", "laotv",
  "hsi-vip-morning", "hsi-morning", "xosohd", "twse-vip", "minhngocstar", "twse",
  "ktop30-vip", "ktop30", "nikkei-afternoon", "nikkei-vip-afternoon", "laoshd", "szse-afternoon",
  "minhngoctv", "szse-vip-afternoon", "hsi-vip-afternoon", "hsi-afternoon", "laostars", "sgx",
  "xosoredcross", "set", "sgx-vip", "laounion", "laosasean", "laosvip", "laounionvip", "laostarsvip",
  "england-vip", "moexbc", "xosoextra", "gdaxi", "ftse100", "germany-vip", "laoredcross", "russia-vip",
  "dowjones-vip", "dowjonestar", "dji", "laocitizen", "laosantipap", "laopatuxay",
] as const;

const GLOBAL_DAILY_SOURCE_SET = new Set<string>(GLOBAL_DAILY_SOURCE_IDS);

export function isGlobalDailySource(lotteryId: string) {
  return GLOBAL_DAILY_SOURCE_SET.has(lotteryId);
}

export function curatedGlobalSources<T extends { lotteryId: string }>(sources: T[]) {
  return sources.filter((source) => isGlobalDailySource(source.lotteryId));
}
