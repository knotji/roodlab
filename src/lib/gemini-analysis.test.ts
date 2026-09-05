import { describe, expect, it } from "vitest";
import { validateGeminiAnalysis } from "./gemini-analysis";

const pairValues = ["01","02","03","04","12","13","14","23","24","34","56","57","58","59","67","68","00","11","22","33","44"];
const valid = { winDigits:["1","2","3","4","5","6"], pairs:pairValues.map((pair) => ({ pair, reason:"อยู่ในข้อมูลที่ส่งให้" })), doubles:["00","11","22","33","44"], summary:"มุมมองเชิงสำรวจ", cautions:["ไม่ใช่การทำนาย"] };

describe("Gemini analysis validation", () => {
  it("accepts only evidence-backed, unique output", () => {
    expect(validateGeminiAnalysis(valid, pairValues, valid.doubles)).toEqual(valid);
  });
  it("rejects duplicate digits, invented pairs, and reversed duplicates", () => {
    expect(() => validateGeminiAnalysis({ ...valid, winDigits:["1","1","3","4","5","6"] }, pairValues, ["11","22"])).toThrow(/duplicate win digits/);
    expect(() => validateGeminiAnalysis({ ...valid, pairs:valid.pairs.map((item, index) => index === 0 ? { pair:"99", reason:"invented" } : item) }, pairValues, valid.doubles)).toThrow(/outside supplied evidence/);
    const reversed = valid.pairs.map((item, index) => index === 1 ? { pair:"10", reason:"reverse" } : item);
    expect(() => validateGeminiAnalysis({ ...valid, pairs:reversed }, [...pairValues,"10"], valid.doubles)).toThrow(/duplicate\/reversed/);
  });
});
