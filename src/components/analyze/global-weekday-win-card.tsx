"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import type { GlobalWeekdayWinResult } from "@/lib/analysis/global-weekday-win";
import { buildWinSet } from "@/lib/analysis/win-set";

type ApiResult = ({ ok: true } & GlobalWeekdayWinResult) | { ok: false; error: string };

export function GlobalWeekdayWinCard() {
  const [result, setResult] = useState<GlobalWeekdayWinResult | null>(null),
    [error, setError] = useState<string | null>(null),
    [winSize, setWinSize] = useState<5 | 6 | 7>(6),
    [method, setMethod] = useState<"ranking" | "411">("ranking"),
    [copied, setCopied] = useState<"digits" | "pairs" | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/global-weekday-win")
      .then(async (response) => ({ response, data: await response.json() as ApiResult }))
      .then(({ response, data }) => {
        if (cancelled) return;
        if (!response.ok || !data.ok) throw new Error("error" in data ? data.error : "โหลดข้อมูลไม่สำเร็จ");
        setResult(data);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "โหลดข้อมูลไม่สำเร็จ");
      });
    return () => { cancelled = true; };
  }, []);

  async function copyValues(mode: "digits" | "pairs", values: string[]) {
    try {
      await navigator.clipboard.writeText(values.join(" "));
      setCopied(mode);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  }

  return <section className="global-weekday-win-card" aria-labelledby="global-win-heading">
    <header>
      <div>
        <div className="section-kicker">ชุดทดลองจากทุกหวย</div>
        <h3 id="global-win-heading">วินรวมทุกหวย{result ? ` · ${result.weekdayLabel}` : "ตามวัน"}</h3>
      </div>
      <div className="global-win-head-actions">
        <div className="global-win-size" role="group" aria-label="จำนวนเลขวินรวมทุกหวย">
          {([5, 6, 7] as const).map((size) => <button key={size} type="button" className={winSize === size ? "active" : ""} aria-pressed={winSize === size} onClick={() => { setWinSize(size); setMethod("ranking"); setCopied(null); }}>{size}</button>)}
        </div>
        <span className={result?.sufficient ? "ready" : "waiting"}>{result?.sufficient ? "ข้อมูลพร้อมสำรวจ" : "ทดลอง"}</span>
      </div>
    </header>
    {!result && !error && <p className="global-win-loading">กำลังรวมสถิติของหวยทั้งหมด…</p>}
    {error && <p className="global-win-error">โหลดวินรวมทุกหวยไม่สำเร็จ · ลองรีเฟรชอีกครั้ง</p>}
    {result && (() => {
      const digits = (method === "411" ? result.global411.digits : result.rankedDigits.slice(0, winSize)).map((item) => item.digit),
        winSet = buildWinSet(digits, winSize);
      return <>
      <div className="global-win-method" role="group" aria-label="วิธีคัดเลขวินรวมทุกหวย">
        <button type="button" className={method === "ranking" ? "active" : ""} aria-pressed={method === "ranking"} onClick={() => setMethod("ranking")}>อันดับรวม</button>
        <button type="button" className={method === "411" ? "active" : ""} aria-pressed={method === "411"} onClick={() => { setMethod("411"); setWinSize(6); setCopied(null); }}>4+1+1</button>
      </div>
      <div className="global-win-digits" aria-label={`วินรวมทุกหวย ${digits.join(" ")}`}>
        {digits.map((digit) => <strong key={digit}>{digit}</strong>)}
      </div>
      {method === "411" && <div className="global-win-411-detail"><span>แกนรวม 4 <b>{result.global411.core.map((item) => item.digit).join(" · ")}</b></span><span>เด่นบน 1 <b>{result.global411.topExtra.digit}</b></span><span>เด่นล่าง 1 <b>{result.global411.bottomExtra.digit}</b></span></div>}
      <div className="global-win-meta">
        <span>ใช้จริง {result.lotteryCount} จากชุดหวยรายวัน {result.sourcePoolCount} หวย · บน {result.topDrawCount} งวด · ล่าง {result.bottomDrawCount} งวด</span>
        <span>ย้อนหลังสูงสุด {result.lookbackPerLottery} {result.weekdayLabel}ต่อหวย · ไม่นับผลวันนี้</span>
      </div>
      {!result.sufficient && <p className="global-win-warning">ข้อมูลรวมยังน้อย ชุดนี้ใช้สำรวจเท่านั้น</p>}
      <footer>
        <small>ใช้ผลบนและล่าง 2 ตัวอย่างละ 50% · หวยแต่ละชนิดมีน้ำหนักเท่ากัน · ไม่ใช่ความน่าจะเป็น</small>
        <div>
          <button type="button" onClick={() => copyValues("digits", digits)}>{copied === "digits" ? <Check /> : <Copy />}{copied === "digits" ? "คัดลอกแล้ว" : `คัดลอก ${winSize} ตัว`}</button>
          <button type="button" className="global-win-copy-pairs" onClick={() => copyValues("pairs", winSet.uniquePairsWithDoubles)}>{copied === "pairs" ? <Check /> : <Copy />}{copied === "pairs" ? "คัดลอกแล้ว" : `รวมเลขเบิ้ล ${winSet.uniquePairsWithDoubles.length} คู่`}</button>
        </div>
      </footer>
      </>;
    })()}
  </section>;
}
