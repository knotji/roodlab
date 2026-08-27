import { parseAllHuayHistory } from "../src/lib/data-sources/allhuay/parser";

const url = "https://www.allhuay.com/lotto/szse-vip-morning";
const res = await fetch(url, {
  headers: { "User-Agent": "RoodLab/0.2 diagnostic" },
  cache: "no-store",
});
const html = await res.text();
console.log("HTTP", res.status, "length", html.length);

const draws = parseAllHuayHistory(html, "szse-vip-morning", url);
console.log("\nParsed count:", draws.length);
console.log("Parsed newest 5:", draws.sort((a, b) => b.drawDate.localeCompare(a.drawDate)).slice(0, 5).map((d) => `${d.drawDate} top3=${d.top3}`));

const rowMatches = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
console.log("\n=== ALL TABLE ROWS (first cell only, first 8) ===");
rowMatches.slice(0, 8).forEach((m, i) => {
  const cells = [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
    c[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
  );
  console.log(i, cells[0] ?? "(empty)", "|", cells.slice(1, 4).join(" / "));
});

const aug26 = html.match(/26[\s\S]{0,20}สิงหาคม[\s\S]{0,20}2569/gi) ?? [];
console.log("\nAug 26 mentions in HTML:", aug26.length);
aug26.slice(0, 5).forEach((m) => console.log(" ", m.replace(/\s+/g, " ").slice(0, 80)));

const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
console.log("\nTable count:", tables.length);
tables.forEach((table, i) => {
  const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const firstData = rows[1]?.[1]?.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/i)?.[1]?.replace(/<[^>]+>/g, "").trim();
  console.log(` table[${i}] rows=${rows.length} firstData=${firstData?.slice(0, 40)}`);
});
