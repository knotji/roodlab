import { z } from "zod";

export const GEMINI_PROMPT_VERSION = "daily-results-focused21-v8-thai";

const PairSelectionSchema = z.object({ pair: z.string().regex(/^\d{2}$/), reason: z.string().min(1).max(180) });

export const GeminiAnalysisSchema = z.object({
  winDigits: z.array(z.string().regex(/^\d$/)).length(6),
  pairs: z.array(PairSelectionSchema).length(21),
  doubles: z.array(z.string().regex(/^(00|11|22|33|44|55|66|77|88|99)$/)).length(5),
  summary: z.string().min(1).max(500),
  cautions: z.array(z.string().min(1).max(220)).max(5),
});

export type GeminiAnalysis = z.infer<typeof GeminiAnalysisSchema>;

export function validateGeminiAnalysis(value: unknown, allowedPairs: string[], allowedDoubles: string[]): GeminiAnalysis {
  const parsed = GeminiAnalysisSchema.parse(value), allowed = new Set(allowedPairs), doubles = new Set(allowedDoubles);
  if (new Set(parsed.winDigits).size !== 6) throw new Error("Gemini returned duplicate win digits");
  const seen = new Set<string>();
  for (const item of parsed.pairs) {
    if (!allowed.has(item.pair)) throw new Error(`Gemini returned pair outside supplied evidence: ${item.pair}`);
    const reverseKey = [...item.pair].sort().join("");
    if (seen.has(reverseKey)) throw new Error(`Gemini returned duplicate/reversed pair: ${item.pair}`);
    seen.add(reverseKey);
  }
  if (parsed.doubles.some((pair) => !doubles.has(pair))) throw new Error("Gemini returned a double outside supplied evidence");
  if (parsed.doubles.some((pair) => !parsed.pairs.some((item) => item.pair === pair))) throw new Error("Gemini doubles must be included in the focused 21 pairs");
  return parsed;
}
