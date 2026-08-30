export type LiveResultSource = {
  url: string;
  closeAt?: string;
  resultAt: string;
  backupUrl?: string;
};

export const LIVE_RESULT_SOURCES: Readonly<Record<string, LiveResultSource>> = {
  laotv: { url: "https://lao-tv.com/", closeAt: "10:20", resultAt: "10:30" },
  xosohd: { url: "https://xosohd.com/", resultAt: "11:30" },
  minhngocstar: { url: "https://minhngocstar.com/", closeAt: "12:00", resultAt: "12:30" },
  minhngoctv: { url: "https://minhngoctv.com/", closeAt: "14:10", resultAt: "14:30" },
  laostars: { url: "https://www.laostars.com/", closeAt: "15:30", resultAt: "15:45" },
  laounionvip: { url: "https://laounionvip.com/", closeAt: "21:25", resultAt: "21:30" },
  xosoredcross: { url: "https://xosoredcross.com/", closeAt: "16:00", resultAt: "16:30" },
  xsthm: { url: "http://www.xsthm.com/", closeAt: "17:00", resultAt: "17:30" },
  minhngoc: { url: "https://www.minhngoc.net.vn/xo-so-truc-tiep/mien-bac.html", closeAt: "18:00", resultAt: "18:30" },
  mlnhngo: { url: "http://www.mlnhngoc.net/", closeAt: "18:50", resultAt: "19:30" },
  laounion: { url: "https://www.laounion.com/", closeAt: "20:00", resultAt: "20:30" },
  laostarsvip: { url: "https://www.laostarsvip.com/", closeAt: "21:45", resultAt: "22:00" },
  laoextra: { url: "https://laoextra.com/", closeAt: "08:25", resultAt: "08:30" },
  "england-vip": { url: "https://lottosuperrich.com/", resultAt: "21:45–21:50" },
  "germany-vip": { url: "https://lottosuperrich.com/", resultAt: "22:45–22:50" },
  "russia-vip": { url: "https://lottosuperrich.com/", resultAt: "23:45–23:50" },
  laoredcross: { url: "https://lao-redcross.com/", closeAt: "23:00", resultAt: "23:30" },
  "dowjones-vip": { url: "https://stocks-vip.com/", backupUrl: "https://dowjonespowerball.com/", closeAt: "00:00", resultAt: "00:30" },
  dowjonestar: { url: "https://dowjonestar.com/", closeAt: "01:05", resultAt: "01:30" },
  xosoextra: { url: "https://www.xosoextra.com/", closeAt: "22:10", resultAt: "22:30" },
  laoshd: { url: "https://laoshd.com/", resultAt: "13:30" },
  "nikkei-vip-morning": { url: "https://nikkeivipstock.com/", closeAt: "09:00", resultAt: "09:05" },
  "szse-vip-morning": { url: "https://shenzhenindex.com/", closeAt: "10:00", resultAt: "10:05" },
  "hsi-vip-morning": { url: "https://hangsengvip.com/", closeAt: "10:30", resultAt: "10:35" },
  "twse-vip": { url: "https://tsecvipindex.com/", closeAt: "11:30", resultAt: "11:35" },
  "ktop30-vip": { url: "https://ktopvipindex.com/", closeAt: "12:30", resultAt: "12:35" },
  "nikkei-vip-afternoon": { url: "https://nikkeivipstock.com/", closeAt: "13:20", resultAt: "13:25" },
  "szse-vip-afternoon": { url: "https://shenzhenindex.com/", closeAt: "14:20", resultAt: "14:25" },
  "hsi-vip-afternoon": { url: "https://hangsengvip.com/", closeAt: "15:20", resultAt: "15:25" },
  "sgx-vip": { url: "https://stocks-vip.com/", closeAt: "17:00", resultAt: "17:05" },
  xosounion: { url: "https://xosounion.com/", closeAt: "17:10", resultAt: "17:15" },
  xosodevelop: { url: "https://xosodevelop.com/", closeAt: "19:10", resultAt: "19:15" },
  hanoiasean: { url: "https://hanoiasean.com/", closeAt: "09:10", resultAt: "09:30" },
  laosasean: { url: "https://lotterylaosasean.com/", closeAt: "20:55", resultAt: "21:00" },
  laopatuxay: { url: "https://laopatuxay.com/", closeAt: "05:40", resultAt: "05:45" },
  laosantipap: { url: "https://laosantipap.com/", closeAt: "06:40", resultAt: "06:45" },
  laocitizen: { url: "https://laocitizen.com/", closeAt: "07:40", resultAt: "07:45" },
};

export function liveResultSource(lotteryId: string) {
  return LIVE_RESULT_SOURCES[lotteryId] ?? null;
}
