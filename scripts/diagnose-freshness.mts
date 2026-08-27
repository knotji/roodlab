import { parseAllHuayHistory } from "../src/lib/data-sources/allhuay/parser";
import { AllHuayDataSource } from "../src/lib/data-sources/allhuay/index";
import { readSnapshot } from "../src/lib/cache";
import fs from "node:fs";

const LOTTERIES = [
  { id: "nikkei-vip-morning", name: "หุ้นนิคเคอิ VIP เช้า" },
  { id: "mlnhngo", name: "ฮานอย VIP" },
  { id: "minhngocstar", name: "ฮานอยสตาร์" },
  { id: "laosdevelops", name: "ลาวพัฒนา" },
  { id: "goverment", name: "รัฐบาล" },
];

const catalog = JSON.parse(fs.readFileSync("./data/lotteries.json", "utf8"));
const ds = new AllHuayDataSource(catalog);

console.log("| Lottery | AllHuay | Parsed | Cache | Status |");
console.log("|---------|---------|--------|-------|--------|");

for (const lot of LOTTERIES) {
  const def = catalog.find((x: { id: string }) => x.id === lot.id);
  if (!def) continue;
  const html = await (
    await fetch(def.sourceUrl, {
      headers: { "User-Agent": "RoodLab/0.2 diagnostic" },
      cache: "no-store",
    })
  ).text();
  const pageDraws = parseAllHuayHistory(html, lot.id, def.sourceUrl);
  const liveLatest =
    pageDraws.sort((a, b) => b.drawDate.localeCompare(a.drawDate))[0]
      ?.drawDate ?? "NONE";
  const fetched = await ds.getHistory(lot.id, { limit: 100 });
  const parsedLatest = fetched[0]?.drawDate ?? "NONE";
  const snap = await readSnapshot(lot.id);
  const cacheLatest = snap?.draws[0]?.drawDate ?? "NONE";
  let status = "OK";
  if (liveLatest !== parsedLatest) status = "PARSER BUG";
  else if (parsedLatest !== cacheLatest) status = "CACHE STALE";
  console.log(
    `| ${lot.name} | ${liveLatest} | ${parsedLatest} | ${cacheLatest} | ${status} |`,
  );
}
