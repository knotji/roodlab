import fs from "node:fs";

const html = fs.readFileSync("scripts/szse-sample.html", "utf8");

function context(needle: string, radius = 250) {
  const idx = html.indexOf(needle);
  if (idx < 0) return null;
  return html.slice(Math.max(0, idx - radius), idx + radius).replace(/\s+/g, " ");
}

console.log("500 context:", context("500"));
console.log("\n80 context (bottom2):", context(">80<"));
console.log("\nlatestResult context:", context("latestResult"));
console.log("\nlottoResult context:", context("lottoResult"));
console.log("\ndrawDate context:", context("drawDate"));
console.log("\nthreeTop context:", context("threeTop"));
console.log("\n3 ตัวบน context:", context("3 ตัวบน", 400));

const rscChunks = [...html.matchAll(/self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g)];
console.log("\nRSC chunks:", rscChunks.length);
for (const chunk of rscChunks) {
  const decoded = chunk[1]
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n")
    .replace(/\\u([0-9a-f]{4})/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    );
  if (
    decoded.includes("500") ||
    decoded.includes("26 สิงหาคม") ||
    decoded.includes("three_top") ||
    decoded.includes("top3")
  ) {
    console.log("\n--- relevant RSC chunk ---");
    console.log(decoded.slice(0, 1200));
  }
}
