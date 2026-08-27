import fs from "node:fs";

const url = "https://www.allhuay.com/lotto/szse-vip-morning";
const html = await (
  await fetch(url, {
    headers: { "User-Agent": "RoodLab/0.2 diagnostic" },
    cache: "no-store",
  })
).text();

fs.writeFileSync("scripts/szse-sample.html", html, "utf8");

for (const pattern of [
  /531[\s\S]{0,200}26[\s\S]{0,200}500/gi,
  /"500"[\s\S]{0,300}26/gi,
  /26 สิงหาคม 2569[\s\S]{0,400}/gi,
]) {
  const matches = [...html.matchAll(pattern)];
  console.log("\nPattern", pattern.source.slice(0, 40), "matches:", matches.length);
  matches.slice(0, 2).forEach((m) =>
    console.log(m[0].replace(/\s+/g, " ").slice(0, 300)),
  );
}

const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)]
  .map((m) => m[1])
  .filter((s) => s.includes("500") || s.includes("26 สิงหาคม") || s.includes("latest"));
console.log("\nScripts with 500 or latest:", scripts.length);
scripts.slice(0, 3).forEach((s) => console.log(s.slice(0, 500)));

const nextData = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
if (nextData) {
  const json = JSON.parse(nextData[1]);
  fs.writeFileSync("scripts/szse-next-data.json", JSON.stringify(json, null, 2));
  console.log("\n__NEXT_DATA__ saved, keys:", Object.keys(json));
  const pageProps = json.props?.pageProps;
  console.log("pageProps keys:", pageProps ? Object.keys(pageProps) : "none");
}
