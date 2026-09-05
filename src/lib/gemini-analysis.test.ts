import { describe, expect, it } from "vitest";
import { validateGeminiAnalysis } from "./gemini-analysis";

const pairValues = ["01","02","03","04","12","13","14","23","24","34","56","57","58","59","67","68","00","11","22","33","44"];
const valid = { selectedDigits:["1","2","3","4","5","6"], evidencePairs:pairValues.map((pair) => ({ pair, reason:"อยู่ในข้อมูลที่ส่งให้" })), summary:"มุมมองเชิงสำรวจ", cautions:["ไม่ใช่การทำนาย"] };
const allowedDoubles = ["00","11","22","33","44"];

describe("Gemini analysis validation", () => {
  it("accepts only evidence-backed, unique output", () => {
    expect(validateGeminiAnalysis(valid, pairValues, allowedDoubles).evidenceDoubles).toEqual(allowedDoubles);
  });
  it("rejects duplicate digits, invented pairs, and reversed duplicates", () => {
    expect(() => validateGeminiAnalysis({ ...valid, selectedDigits:["1","1","3","4","5","6"] }, pairValues, ["11","22"])).toThrow(/duplicate selected digits/);
    expect(() => validateGeminiAnalysis({ ...valid, evidencePairs:valid.evidencePairs.map((item, index) => index === 0 ? { pair:"99", reason:"invented" } : item) }, pairValues, allowedDoubles)).toThrow(/outside supplied evidence/);
    const reversed = valid.evidencePairs.map((item, index) => index === 1 ? { pair:"10", reason:"reverse" } : item);
    expect(() => validateGeminiAnalysis({ ...valid, evidencePairs:reversed }, [...pairValues,"10"], allowedDoubles)).toThrow(/duplicate\/reversed/);
  });
  it("rejects unsupported predictive language in rationale", () => {
    expect(() => validateGeminiAnalysis({ ...valid, summary:"เลขชุดนี้มีแนวโน้มเด่น" }, pairValues, allowedDoubles)).toThrow(/unsupported predictive language/);
  });
});
