import { z } from "zod";

export const GEMINI_PROMPT_VERSION = "normalized-evidence-v13-thai";

const PairSelectionSchema = z.object({ pair: z.string().regex(/^\d{2}$/), reason: z.string().min(1).max(180) });

export const GeminiAnalysisSchema = z.object({
  selectedDigits: z.array(z.string().regex(/^\d$/)).length(6),
  evidencePairs: z.array(PairSelectionSchema).length(21),
  summary: z.string().min(1).max(500),
  cautions: z.array(z.string().min(1).max(220)).max(5),
}).transform((value) => ({
  ...value,
  evidenceDoubles: value.evidencePairs.map((item) => item.pair).filter((pair) => pair[0] === pair[1]),
}));

export type GeminiAnalysis = z.infer<typeof GeminiAnalysisSchema>;

export function validateGeminiAnalysis(value: unknown, allowedPairs: string[], allowedDoubles: string[]): GeminiAnalysis {
  const parsed = GeminiAnalysisSchema.parse(value), allowed = new Set(allowedPairs), doubles = new Set(allowedDoubles);
  if (new Set(parsed.selectedDigits).size !== 6) throw new Error("Gemini returned duplicate selected digits");
  const seen = new Set<string>();
  for (const item of parsed.evidencePairs) {
    if (!allowed.has(item.pair)) throw new Error(`Gemini returned pair outside supplied evidence: ${item.pair}`);
    const reverseKey = [...item.pair].sort().join("");
    if (seen.has(reverseKey)) throw new Error(`Gemini returned duplicate/reversed pair: ${item.pair}`);
    seen.add(reverseKey);
  }
  if (parsed.evidenceDoubles.length > 5) throw new Error("Gemini returned more than five doubles");
  if (parsed.evidenceDoubles.some((pair) => !doubles.has(pair))) throw new Error("Gemini returned a double outside supplied evidence");
  const unsupportedClaims = ["แนวโน้ม", "มีนัยสำคัญ", "โอกาสออก", "มีโอกาส", "น่าจะออก"],
    explanatoryText = [parsed.summary, ...parsed.evidencePairs.map((item) => item.reason)].join(" ");
  if (unsupportedClaims.some((claim) => explanatoryText.includes(claim))) throw new Error("Gemini rationale contains unsupported predictive language");
  return parsed;
}
