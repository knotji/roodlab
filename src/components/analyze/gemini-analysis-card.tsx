"use client";

import { Check, Copy, Sparkles } from "lucide-react";
import { useState } from "react";
import type { GeminiAnalysis } from "@/lib/gemini-analysis";

type ApiResponse = ({ ok: true; model: string; promptVersion: string; cached: boolean } & GeminiAnalysis) | { ok: false; error: string };

export function GeminiAnalysisCard() {
  const [result, setResult] = useState<(GeminiAnalysis & { model: string; cached: boolean }) | null>(null),
    [loading, setLoading] = useState(false), [error, setError] = useState<string | null>(null), [copied, setCopied] = useState<"digits" | "pairs" | null>(null);
  async function analyze() {
    setLoading(true); setError(null);
    try {
      const response = await fetch("/api/gemini-analysis", { method: "POST" }), data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok) throw new Error("error" in data ? data.error : "วิเคราะห์ไม่สำเร็จ");
      setResult(data);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "วิเคราะห์ไม่สำเร็จ"); }
    finally { setLoading(false); }
  }
  async function copy(type: "digits" | "pairs", values: string[]) {
    await navigator.clipboard.writeText(values.join(" ")); setCopied(type); window.setTimeout(() => setCopied(null), 1600);
  }
  return <section className="gemini-analysis-card">
    <header><div><span aria-hidden="true"><Sparkles /></span><div><strong>สรุปผลประจำวันด้วย Gemini</strong><small>อ่านผลย้อนหลังรายงวดโดยตรง ไม่ใช้คำตอบจาก Production เป็นตัวตั้ง</small></div></div>{result && <small>{result.cached ? "ผลจาก cache" : "วิเคราะห์ใหม่"} · {result.model}</small>}</header>
    {!result && <div className="gemini-analysis-intro"><p>ส่งสรุปผลบน–ล่างของวันเดียวกันจากทุกหวยให้ Gemini คัดวิน 6 ตัวและ 21 คู่เน้น รวมเลขเบิ้ล 5 ตัว</p><button type="button" disabled={loading} onClick={analyze}><Sparkles />{loading ? "Gemini กำลังวิเคราะห์…" : "สรุปผลและคัดชุด"}</button></div>}
    {error && <p className="gemini-analysis-error">{error}</p>}
    {result && <div className="gemini-analysis-result">
      <div className="gemini-win"><div><span>วิน 6 จาก Gemini</span><div aria-label={`วิน Gemini ${result.winDigits.join(" ")}`}>{result.winDigits.map((digit) => <b key={digit}>{digit}</b>)}</div></div><button type="button" onClick={() => copy("digits", result.winDigits)}>{copied === "digits" ? <Check /> : <Copy />}{copied === "digits" ? "คัดลอกแล้ว" : "คัดลอกวิน"}</button></div>
      <div className="gemini-pairs"><div><span>21 คู่เน้นจาก Gemini · รวมเบิ้ล 5 ตัวแล้ว</span><div>{result.pairs.map((item) => <b key={item.pair} title={item.reason}>{item.pair}</b>)}</div></div><button type="button" onClick={() => copy("pairs", result.pairs.map((item) => item.pair))}>{copied === "pairs" ? <Check /> : <Copy />}{copied === "pairs" ? "คัดลอกแล้ว" : "คัดลอก 21 คู่"}</button></div>
      <p><strong>เลขเบิ้ลในชุด:</strong> {result.doubles.join(" · ")}</p>
      <details className="gemini-pair-reasons"><summary>ดูเหตุผลวิเคราะห์ทั้ง 21 คู่</summary><ol>{result.pairs.map((item) => <li key={item.pair}><b>{item.pair}</b><span>{item.reason}</span></li>)}</ol></details>
      <p>{result.summary}</p>
      {result.cautions.length > 0 && <ul>{result.cautions.map((item) => <li key={item}>{item}</li>)}</ul>}
      <button className="gemini-rerun" type="button" disabled={loading} onClick={analyze}>{loading ? "กำลังวิเคราะห์…" : "เรียกวิเคราะห์อีกครั้ง"}</button>
    </div>}
    <footer>ผลจาก AI เป็นการสำรวจรูปแบบย้อนหลัง ไม่ใช่ค่าความน่าจะเป็นหรือการรับรองผล</footer>
  </section>;
}
