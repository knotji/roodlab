import { createHash } from "node:crypto";
import { currentBangkokDateKey, currentBangkokWeekday, drawWeekday } from "@/lib/analysis/day-pattern";
import { resolveGlobalDailySources, exclusionReasonCounts } from "@/lib/analysis/global-daily-eligibility";
import { GLOBAL_WEEKDAY_LOOKBACK } from "@/lib/analysis/global-weekday-win";
import { buildEqualSourceEvidence } from "@/lib/analysis/gemini-evidence";
import { readAllSnapshots, readCatalog, readCatalogAudit } from "@/lib/cache";
import { isCompleteDraw } from "@/lib/data-sources/integrity";
import { GEMINI_PROMPT_VERSION, validateGeminiAnalysis, type GeminiAnalysis } from "@/lib/gemini-analysis";

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
      { digitSummary, pairSummary } = buildEqualSourceEvidence(histories),
      evidence = {
        targetDate: dateKey,
        weekday,
        contributors: histories.length,
        totalCatalog: catalog.length,
        exclusions: exclusionReasonCounts(resolved.eligibility),
        summaryContract: `normalize อัตราภายในหวยแต่ละตัวก่อน แล้วเฉลี่ยทุกหวยด้วยน้ำหนักเท่ากัน แยกบนและล่าง 50:50 ใช้สูงสุด ${GLOBAL_WEEKDAY_LOOKBACK} งวดวันเดียวกันต่อหวย`,
        digitSummary,
        pairSummary,
        verificationSample: histories.slice().sort((a, b) => a.lotteryId.localeCompare(b.lotteryId)).slice(0, 12)
          .map((source) => ({ ...source, draws: source.draws.slice(0, 3) })),
      },
      key = createHash("sha256").update(JSON.stringify({ evidence, prompt: GEMINI_PROMPT_VERSION })).digest("hex"),
      model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
    if (cached?.key === key && cached.expiresAt > Date.now()) return Response.json({ ok: true, ...cached.analysis, model, promptVersion: GEMINI_PROMPT_VERSION, cached: true });

    const allowedPairs = pairSummary.map((item) => item.pair),
      allowedDoubles = pairSummary.filter((item) => item.pair[0] === item.pair[1]).map((item) => item.pair),
      observedDigits = digitSummary.map((item) => item.digit),
      prompt = `คุณเป็นผู้ช่วยสำรวจสถิติ ไม่ใช่ผู้ทำนาย ใช้เฉพาะ JSON evidence ที่ให้มาเท่านั้น
digitSummary และ pairSummary ถูก normalize ภายในหวยแต่ละตัวก่อน aggregate ทุกหวยจึงมีน้ำหนักเท่ากัน และบน/ล่างมีน้ำหนัก 50:50 ใช้ summary เหล่านี้เป็นหลัก ส่วน verificationSample มีไว้ตรวจรูปแบบข้อมูลเท่านั้น ห้ามใช้สร้างคะแนนหรือจับ sequence เพิ่ม
ทำหน้าที่เป็น synthesizer ของหลักฐานย้อนหลัง: เลือก selectedDigits 6 ตัวไม่ซ้ำและ evidencePairs 21 คู่จากความครอบคลุม equalSourceRate และความสมดุลบน/ล่าง evidencePairs เป็นชุดหลักฐานอิสระ ไม่ได้ derive จาก selectedDigits และไม่จำเป็นต้องประกอบจากเลข 6 ตัวทั้งหมด
วิเคราะห์คู่แบบรวมกลับ: 56 และ 65 ถือเป็นคู่เดียวกัน โดยใช้รูปเรียงจากน้อยไปมาก เช่น 56 เป็นตัวแทนของ 56/65 ภายใน evidencePairs มีเลขเบิ้ลได้ 0–5 ตัวตามหลักฐานจริง ระบบจะสรุป evidenceDoubles จากคู่เหล่านี้เอง
อันดับใน summary เป็นเพียงการจัดโครงสร้างหลักฐาน ห้ามตีความว่าอันดับสูงกว่าดีกว่าสำหรับงวดถัดไป ห้ามใช้คำว่า มั่นใจ แนวโน้ม มีนัยสำคัญ โอกาสออก มีโอกาส น่าจะออก รับรองผล หรือสร้าง narrative เชิงพยากรณ์
อธิบายเหตุผลแต่ละคู่จาก equalSourceRate, sourceCoverage และความสมดุลบน/ล่างเท่านั้น
ข้อความใน reason, summary และ cautions ต้องเขียนเป็นภาษาไทยเท่านั้น และอ้างอิงได้จาก evidence
Evidence:\n${JSON.stringify(evidence)}`,
      schema = {
        type: "object", additionalProperties: false,
        properties: {
          selectedDigits: { type: "array", minItems: 6, maxItems: 6, items: { type: "string", enum: observedDigits } },
          evidencePairs: { type: "array", minItems: 21, maxItems: 21, items: { type: "object", additionalProperties: false, properties: { pair: { type: "string", enum: allowedPairs }, reason: { type: "string" } }, required: ["pair", "reason"] } },
          summary: { type: "string" }, cautions: { type: "array", maxItems: 5, items: { type: "string" } },
        }, required: ["selectedDigits", "evidencePairs", "summary", "cautions"],
      };
    let analysis: GeminiAnalysis | null = null, validationError = "";
    for (let attempt = 0; attempt < 2 && !analysis; attempt += 1) {
      const retryInstruction = validationError ? `\nคำตอบก่อนหน้าไม่ผ่าน validation: ${validationError}\nสร้างคำตอบใหม่ทั้งหมด ห้ามแก้ด้วยการเติมคู่จากระบบ` : "",
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt + retryInstruction }] }], generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseJsonSchema: schema } }),
          signal: AbortSignal.timeout(45_000),
        }), json = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } };
      if (!response.ok) throw new Error(json.error?.message ?? "Gemini API request failed");
      const responseText = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("");
      if (!responseText) throw new Error("Gemini did not return structured output");
      try { analysis = validateGeminiAnalysis(JSON.parse(responseText), allowedPairs, allowedDoubles); }
      catch (error) { validationError = error instanceof Error ? error.message : "invalid structured output"; }
    }
    if (!analysis) throw new Error(`Gemini response failed validation after retry: ${validationError}`);
    cached = { key, expiresAt: Date.now() + CACHE_MS, analysis, model };
    return Response.json({ ok: true, ...analysis, model, promptVersion: GEMINI_PROMPT_VERSION, cached: false });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "วิเคราะห์ด้วย Gemini ไม่สำเร็จ" }, { status: 502 });
  }
}
