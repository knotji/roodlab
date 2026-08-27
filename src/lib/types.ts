import { z } from "zod";

export const LotteryDrawSchema = z.object({
  id: z.string(), lotteryId: z.string(), drawDate: z.string(),
  top3: z.string().regex(/^\d{3}$/).optional(),
  top2: z.string().regex(/^\d{2}$/).optional(),
  bottom2: z.string().regex(/^\d{2}$/).optional(),
  sourceUrl: z.string().url().optional(),
  source: z.enum(["current-result", "historical-table"]).optional(),
  completeness: z.enum(["complete", "partial"]).optional(),
});
export type LotteryDraw = z.infer<typeof LotteryDrawSchema>;
export type CanonicalLotteryDraw = LotteryDraw & {
  source: "current-result" | "historical-table";
  completeness: "complete" | "partial";
};
export type LotteryCapabilities = { top3: boolean; top2: boolean; bottom2: boolean };
export type LotteryNormalizationRules = { deriveTop2FromTop3: boolean };
export type LotteryDefinition = { id: string; name: string; slug: string; category: string; sourceUrl: string; isActive?: boolean; capabilities?: LotteryCapabilities; normalizationRules?: LotteryNormalizationRules };
export interface LotteryDataSource {
  getLotteries(): Promise<LotteryDefinition[]>;
  getHistory(lotteryId: string, options?: { limit?: number }): Promise<LotteryDraw[]>;
}
export type CanonicalHistoryResult = { draws: LotteryDraw[]; currentSourceResultDate: string | null; conflicts: number; template: "hero+history" | "history-only" | "partial-hero" | "unsupported-template" };
