"use client";

import { Check, ChevronDown, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import type { GlobalWeekdayWinResult } from "@/lib/analysis/global-weekday-win";
import { formatRankBoundaryGap } from "@/lib/analysis/global-score-distribution";
import { buildWinSet } from "@/lib/analysis/win-set";

type ApiResult = ({ ok: true } & GlobalWeekdayWinResult) | { ok: false; error: string };

export function GlobalWeekdayWinCard() {
  const [result, setResult] = useState<GlobalWeekdayWinResult | null>(null),
    [error, setError] = useState<string | null>(null),
    [winSize, setWinSize] = useState<5 | 6 | 7>(6),
    [showPairs, setShowPairs] = useState(false),
    [copied, setCopied] = useState<"digits" | "pairs" | "frequentTop10" | "frequentTop15" | "frequentPairs" | null>(null);

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

  async function copyValues(mode: "digits" | "pairs" | "frequentTop10" | "frequentTop15" | "frequentPairs", values: string[]) {
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
          {([5, 6, 7] as const).map((size) => <button key={size} type="button" className={winSize === size ? "active" : ""} aria-pressed={winSize === size} onClick={() => { setWinSize(size); setShowPairs(false); setCopied(null); }}>{size}</button>)}
        </div>
        <span className={result?.sufficient ? "ready" : "waiting"}>{result?.sufficient ? "ข้อมูลพร้อมสำรวจ" : "ทดลอง"}</span>
      </div>
    </header>
    {!result && !error && <p className="global-win-loading">กำลังรวมสถิติของหวยทั้งหมด…</p>}
    {error && <p className="global-win-error">โหลดวินรวมทุกหวยไม่สำเร็จ · ลองรีเฟรชอีกครั้ง</p>}
    {result && (() => {
      const digits = result.rankedDigits.slice(0, winSize).map((item) => item.digit),
        winSet = buildWinSet(digits, winSize),
        recommendedPairs = result.frequentPairs.slice(0, 21),
        focusedPairs = recommendedPairs.slice(0, 10);
      return <>
      <div className="global-win-digits" aria-label={`วินรวมทุกหวย ${digits.join(" ")}`}>
        {digits.map((digit) => <strong key={digit}>{digit}</strong>)}
      </div>
      <div className="global-win-meta">
        <span>ข้อมูลพร้อม {result.lotteryCount} จากทั้งหมด {result.eligibility?.totalCatalog ?? result.sourcePoolCount} หวย · บน {result.topDrawCount} งวด · ล่าง {result.bottomDrawCount} งวด</span>
        <span>ย้อนหลังสูงสุด {result.lookbackPerLottery} {result.weekdayLabel}ต่อหวย · ไม่นับผลวันนี้</span>
      </div>
      <div className="global-win-score-gap"><span>โครงสร้างคะแนนวันนี้</span><strong>{formatRankBoundaryGap(result.scoreDistribution.rank6To7Gap)}</strong></div>
      <div className="global-win-frequent-pairs">
        <div><strong>คู่เน้นรอบโลกประจำ{result.weekdayLabel} · 21 คู่</strong><span>คัดจากคู่ที่พบบ่อยที่สุด รวมเลขเบิ้ล และไม่นับคู่กลับซ้ำ</span></div>
        <div className="global-win-frequent-pair-groups" aria-label={`คู่เน้นรอบโลก ${recommendedPairs.map((item) => item.pair).join(" ")}`}>
          <div><span>เน้น 10 คู่</span><div className="global-win-frequent-pair-list focused">{focusedPairs.map((item) => <b key={item.pair}>{item.pair}</b>)}</div></div>
          <details><summary>ดูชุดรองอีก 11 คู่</summary><div className="global-win-frequent-pair-list">{recommendedPairs.slice(10).map((item) => <b key={item.pair}>{item.pair}</b>)}</div></details>
        </div>
        <div className="global-win-frequent-pair-footer">
          <small>สรุปจากบน–ล่างน้ำหนักเท่ากัน · ไม่ใช่ค่าความน่าจะเป็น</small>
          <div>
            <button type="button" onClick={() => copyValues("frequentTop10", focusedPairs.map((item) => item.pair))}>{copied === "frequentTop10" ? <Check /> : <Copy />}{copied === "frequentTop10" ? "คัดลอกแล้ว" : "คัดลอกเน้น 10 คู่"}</button>
            <button type="button" onClick={() => copyValues("frequentTop15", recommendedPairs.slice(0, 15).map((item) => item.pair))}>{copied === "frequentTop15" ? <Check /> : <Copy />}{copied === "frequentTop15" ? "คัดลอกแล้ว" : "คัดลอก 15 คู่"}</button>
            <button type="button" onClick={() => copyValues("frequentPairs", recommendedPairs.map((item) => item.pair))}>{copied === "frequentPairs" ? <Check /> : <Copy />}{copied === "frequentPairs" ? "คัดลอกแล้ว" : "คัดลอก 21 คู่"}</button>
          </div>
        </div>
      </div>
      {!result.sufficient && <p className="global-win-warning">ข้อมูลรวมยังน้อย ชุดนี้ใช้สำรวจเท่านั้น</p>}
      {showPairs && <div className="global-win-pair-space" id="global-win-pair-space">
        <div>
          <span>คู่ไม่เบิ้ล · {winSet.uniquePairs.length} คู่</span>
          <div className="global-win-pair-list">{winSet.uniquePairs.map((pair) => <b key={pair}>{pair}</b>)}</div>
        </div>
        <div>
          <span>เลขเบิ้ล · {winSet.doubles.length} คู่</span>
          <div className="global-win-pair-list doubles">{winSet.doubles.map((pair) => <b key={pair}>{pair}</b>)}</div>
        </div>
        <button type="button" onClick={() => copyValues("pairs", winSet.uniquePairsWithDoubles)}>{copied === "pairs" ? <Check /> : <Copy />}{copied === "pairs" ? "คัดลอกแล้ว" : `คัดลอกทั้งหมด ${winSet.uniquePairsWithDoubles.length} คู่`}</button>
      </div>}
      <footer>
        <small>จัดอันดับจากรูปแบบย้อนหลังของหวยรายวัน<br />ใช้เพื่อสำรวจข้อมูล ไม่ใช่ค่าความน่าจะเป็น</small>
        <div>
          <button type="button" onClick={() => copyValues("digits", digits)}>{copied === "digits" ? <Check /> : <Copy />}{copied === "digits" ? "คัดลอกแล้ว" : `คัดลอก ${winSize} ตัว`}</button>
          <button type="button" className="global-win-copy-pairs" aria-expanded={showPairs} aria-controls="global-win-pair-space" onClick={() => setShowPairs((visible) => !visible)}>ดูชุดทั้งหมด {winSet.uniquePairsWithDoubles.length} คู่<ChevronDown className={showPairs ? "open" : ""} /></button>
        </div>
      </footer>
      </>;
    })()}
  </section>;
}
