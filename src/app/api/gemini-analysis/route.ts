import { createHash } from "node:crypto";
import { currentBangkokDateKey, currentBangkokWeekday, drawWeekday } from "@/lib/analysis/day-pattern";
import { resolveGlobalDailySources, exclusionReasonCounts } from "@/lib/analysis/global-daily-eligibility";
import { GLOBAL_WEEKDAY_LOOKBACK } from "@/lib/analysis/global-weekday-win";
import { readAllSnapshots, readCatalog, readCatalogAudit } from "@/lib/cache";
import { isCompleteDraw } from "@/lib/data-sources/integrity";
import { GEMINI_PROMPT_VERSION, GeminiAnalysisSchema, validateGeminiAnalysis, type GeminiAnalysis } from "@/lib/gemini-analysis";

const CACHE_MS = 24 * 60 * 60 * 1000;
let cached: { key: string; expiresAt: number; analysis: GeminiAnalysis; model: string } | null = null;

export async function POST() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ ok: false, error: "ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์" }, { status: 503 });
  try {
    const dateKey = currentBangkokDateKey(), weekday = currentBangkokWeekday(),
      [catalog, snapshots, audit] = await Promise.all([readCatalog(), readAllSnapshots(), readCatalogAudit()]),
      resolved = resolveGlobalDailySources({ catalog, snapshots, audit, targetDate: dateKey, weekday }),
      names = new Map(catalog.map((lottery) => [lottery.id, lottery.name])),
      histories = resolved.sources.map((snapshot) => ({
        lotteryId: snapshot.lotteryId,
        lotteryName: names.get(snapshot.lotteryId) ?? snapshot.lotteryId,
        draws: snapshot.draws.filter((draw) => draw.drawDate < dateKey && drawWeekday(draw.drawDate) === weekday && isCompleteDraw(draw))
          .sort((a, b) => b.drawDate.localeCompare(a.drawDate)).slice(0, GLOBAL_WEEKDAY_LOOKBACK)
          .map(({ drawDate, top2, bottom2 }) => ({ drawDate, top2, bottom2 })),
      })).filter((source) => source.draws.length > 0),
      pairEvidence = new Map<string, { pair: string; hits: number; topHits: number; bottomHits: number; lotteries: Set<string> }>(),
      digitEvidence = new Map(Array.from({ length: 10 }, (_, digit) => [String(digit), { digit: String(digit), sideHits: 0, topHits: 0, bottomHits: 0, lotteries: new Set<string>() }]));
    for (const source of histories) for (const draw of source.draws) for (const [side, value] of [["top", draw.top2], ["bottom", draw.bottom2]] as const) {
      if (!value) continue;
      const pair = value, pairItem = pairEvidence.get(pair) ?? { pair, hits: 0, topHits: 0, bottomHits: 0, lotteries: new Set<string>() };
      pairItem.hits += 1; pairItem[side === "top" ? "topHits" : "bottomHits"] += 1; pairItem.lotteries.add(source.lotteryId); pairEvidence.set(pair, pairItem);
      for (const digit of new Set(value)) {
        const item = digitEvidence.get(digit)!;
        item.sideHits += 1; item[side === "top" ? "topHits" : "bottomHits"] += 1; item.lotteries.add(source.lotteryId);
      }
    }
    const pairSummary = [...pairEvidence.values()].map(({ lotteries, ...item }) => ({ ...item, lotteryCoverage: lotteries.size }))
        .sort((a, b) => b.lotteryCoverage - a.lotteryCoverage || b.hits - a.hits || b.topHits - a.topHits || a.pair.localeCompare(b.pair)),
      digitSummary = [...digitEvidence.values()].map(({ lotteries, ...item }) => ({ ...item, lotteryCoverage: lotteries.size }))
        .sort((a, b) => b.lotteryCoverage - a.lotteryCoverage || b.sideHits - a.sideHits || a.digit.localeCompare(b.digit)),
      evidence = {
        targetDate: dateKey,
        weekday,
        contributors: histories.length,
        totalCatalog: catalog.length,
        exclusions: exclusionReasonCounts(resolved.eligibility),
        summaryContract: `ผลย้อนหลังวันเดียวกัน สูงสุด ${GLOBAL_WEEKDAY_LOOKBACK} งวดต่อหวย แสดงผลบนและล่างตามจริง`,
        digitSummary,
        pairSummary,
        lotteryResults: histories,
      },
      key = createHash("sha256").update(JSON.stringify({ evidence, prompt: GEMINI_PROMPT_VERSION })).digest("hex"),
      model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
    if (cached?.key === key && cached.expiresAt > Date.now()) return Response.json({ ok: true, ...cached.analysis, model, promptVersion: GEMINI_PROMPT_VERSION, cached: true });

    const allowedPairs = pairSummary.map((item) => item.pair),
      allowedDoubles = pairSummary.filter((item) => item.pair[0] === item.pair[1]).map((item) => item.pair),
      observedDigits = digitSummary.map((item) => item.digit),
      prompt = `คุณเป็นผู้ช่วยสำรวจสถิติ ไม่ใช่ผู้ทำนาย ใช้เฉพาะ JSON evidence ที่ให้มาเท่านั้น
ข้อมูลคือผลหวยจริงย้อนหลังของหวยแต่ละรายการ เฉพาะวันในสัปดาห์เดียวกับ targetDate สูงสุด 12 งวดต่อหวย มี top2 และ bottom2 แยกกัน
ใช้ digitSummary และ pairSummary เป็นสถิติสรุป แล้วตรวจบริบทกับ lotteryResults ก่อนเลือก อย่าเลือกตามลำดับตัวเลขหรือ enum เลือก winDigits 6 ตัวไม่ซ้ำและ pairs จำนวน 21 คู่รวมเลขเบิ้ล 5 ตัว โดยใช้จำนวนหวยที่พบ จำนวนครั้งที่พบ ความสม่ำเสมอข้ามหวย ความสมดุลบน/ล่าง และความเชื่อมโยงกับวิน 6 ห้ามอาศัยอันดับ Production เพราะ evidence ไม่มีคะแนนหรืออันดับ Production
คู่ต้องรักษาทิศทางตามผลจริง เช่น 56 และ 65 เป็นคนละผล แต่ในชุดที่เลือกห้ามหยิบทั้งคู่พร้อมกัน doubles ต้องมี 5 ตัวและต้องอยู่ภายใน pairs 21 คู่แล้ว
อธิบายเหตุผลของแต่ละคู่ให้ละเอียดพอแยกได้ว่าหลักฐานมาจากความครอบคลุม จำนวนครั้ง หรือความสมดุลด้านใด ห้ามอ้างว่าเป็นความน่าจะเป็นของงวดหน้า ห้ามใช้คำว่ามั่นใจ โอกาสออก หรือรับรองผล
ข้อความใน reason, summary และ cautions ต้องเขียนเป็นภาษาไทยเท่านั้น และอ้างอิงได้จาก evidence
Evidence:\n${JSON.stringify(evidence)}`,
      schema = {
        type: "object", additionalProperties: false,
        properties: {
          winDigits: { type: "array", minItems: 6, maxItems: 6, items: { type: "string", enum: observedDigits } },
          pairs: { type: "array", minItems: 21, maxItems: 21, items: { type: "object", additionalProperties: false, properties: { pair: { type: "string", enum: allowedPairs }, reason: { type: "string" } }, required: ["pair", "reason"] } },
          doubles: { type: "array", minItems: 5, maxItems: 5, items: { type: "string", enum: allowedDoubles } },
          summary: { type: "string" }, cautions: { type: "array", maxItems: 5, items: { type: "string" } },
        }, required: ["winDigits", "pairs", "doubles", "summary", "cautions"],
      },
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseJsonSchema: schema } }),
        signal: AbortSignal.timeout(45_000),
      }), json = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } };
    if (!response.ok) throw new Error(json.error?.message ?? "Gemini API request failed");
    const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("");
    if (!text) throw new Error("Gemini did not return structured output");
    const raw = GeminiAnalysisSchema.parse(JSON.parse(text)), seenPairKeys = new Set<string>(),
      selected = raw.pairs.filter((item) => {
        const key = [...item.pair].sort().join("");
        if (seenPairKeys.has(key)) return false;
        seenPairKeys.add(key); return true;
      });
    for (const double of raw.doubles) {
      if (selected.some((item) => item.pair === double)) continue;
      const replaceAt = selected.findLastIndex((item) => !raw.doubles.includes(item.pair));
      if (replaceAt >= 0) {
        seenPairKeys.delete([...selected[replaceAt].pair].sort().join(""));
        selected.splice(replaceAt, 1);
      }
      selected.push({ pair: double, reason: "เลขเบิ้ลที่มีหลักฐานเด่นในสรุปผลประจำวัน" });
      seenPairKeys.add(double);
    }
    for (const pair of allowedPairs) {
      if (selected.length === 21) break;
      const pairKey = [...pair].sort().join("");
      if (seenPairKeys.has(pairKey)) continue;
      seenPairKeys.add(pairKey);
      selected.push({ pair, reason: "เติมจากคู่ที่พบครอบคลุมหลายหวยในสรุปผลประจำวัน" });
    }
    if (selected.length !== 21) throw new Error("Daily evidence does not contain enough unique pairs");
    const analysis = validateGeminiAnalysis({ ...raw, pairs: selected }, allowedPairs, allowedDoubles);
    cached = { key, expiresAt: Date.now() + CACHE_MS, analysis, model };
    return Response.json({ ok: true, ...analysis, model, promptVersion: GEMINI_PROMPT_VERSION, cached: false });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "วิเคราะห์ด้วย Gemini ไม่สำเร็จ" }, { status: 502 });
  }
}
