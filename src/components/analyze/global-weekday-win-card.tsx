"use client";

import { CalendarDays, Check, ChevronDown, CircleHelp, Copy, Database, FileWarning, Globe2, KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import type { GlobalWeekdayWinResult } from "@/lib/analysis/global-weekday-win";
import { formatRankBoundaryGap } from "@/lib/analysis/global-score-distribution";
import { buildWinSet, deriveWin6PairSet } from "@/lib/analysis/win-set";

type GlobalUniverseMeta = { mode: "played" | "all_eligible_fallback"; weekday: number; configuredCount: number; eligibleCount: number };
type GlobalDailyResult = GlobalWeekdayWinResult & { universe?: GlobalUniverseMeta };
type ApiResult = ({ ok: true } & GlobalDailyResult) | { ok: false; error: string };

export function GlobalWeekdayWinCard({ onCutoffDateChange }: { onCutoffDateChange?: (date: string) => void } = {}) {
  const [result, setResult] = useState<GlobalDailyResult | null>(null),
    [error, setError] = useState<string | null>(null),
    [winSize, setWinSize] = useState<5 | 6 | 7>(6),
    [showPairs, setShowPairs] = useState(false),
    [copied, setCopied] = useState<"digits" | "pairs" | "pairDigits" | "frequentDoubles" | "frequentTop10" | "frequentTop15" | "frequentTop21" | "frequentPairs" | "win6Pairs" | "win6Expanded" | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/global-weekday-win")
      .then(async (response) => ({ response, data: await response.json() as ApiResult }))
      .then(({ response, data }) => {
        if (cancelled) return;
        if (!response.ok || !data.ok) throw new Error("error" in data ? data.error : "โหลดข้อมูลไม่สำเร็จ");
        setResult(data);
        onCutoffDateChange?.(data.cutoffDate);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "โหลดข้อมูลไม่สำเร็จ");
      });
    return () => { cancelled = true; };
  }, [onCutoffDateChange]);

  async function copyValues(mode: "digits" | "pairs" | "pairDigits" | "frequentDoubles" | "frequentTop10" | "frequentTop15" | "frequentTop21" | "frequentPairs" | "win6Pairs" | "win6Expanded", values: string[]) {
    try {
      await navigator.clipboard.writeText(values.join(" "));
      setCopied(mode);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  }

  return <section className="global-weekday-win-card" aria-labelledby="global-win-heading">
    {!result && !error && <p className="global-win-loading">กำลังรวมสถิติของหวยทั้งหมด…</p>}
    {error && <p className="global-win-error">โหลดวินรวมทุกหวยไม่สำเร็จ · ลองรีเฟรชอีกครั้ง</p>}
    {result && (() => {
      const digits = result.rankedDigits.slice(0, winSize).map((item) => item.digit),
        winSet = buildWinSet(digits, winSize),
        productionWin6 = result.digits.map((item) => item.digit),
        win6PairSet = deriveWin6PairSet(productionWin6),
        win6CanonicalItems = [...win6PairSet.nonDoublePairs, ...win6PairSet.doubles],
        recommendedPairs = result.frequentPairs.slice(0, 50),
        focusedPairs = recommendedPairs.slice(0, 10),
        restPairs = recommendedPairs.slice(10, 21),
        pairsWithDoubles = (size: number) => [...new Set([
          ...recommendedPairs.slice(0, size).map((item) => item.pair),
          ...result.frequentDoubles.map((item) => item.pair),
        ])];
      const totalCatalog = result.eligibility?.totalCatalog ?? result.sourcePoolCount,
        excluded = Math.max(0, totalCatalog - result.lotteryCount),
        universe = result.universe,
        heroSubtitle = universe?.mode === "played"
          ? "คำนวณจากหวยที่เล่นวันนี้"
          : universe?.mode === "all_eligible_fallback"
            ? "ยังไม่มีรายการหวยที่เล่นสำหรับวันนี้ จึงใช้ข้อมูลรอบโลก"
            : "สรุปจากสถิติย้อนหลังของหวยรายวันที่มีข้อมูลครบ",
        universeBadge = universe
          ? `รายการที่เล่น ${universe.configuredCount} หวย · ใช้คำนวณวันนี้ ${universe.eligibleCount} หวย`
          : `ข้อมูลพร้อม ${result.lotteryCount} จากทั้งหมด ${totalCatalog} หวย`;
      return <>
      <section className="global-daily-hero">
        <header className="global-daily-header">
          <div className="global-daily-title"><span aria-hidden="true"><Globe2 /></span><div><h3 id="global-win-heading">Global Daily</h3><p>{heroSubtitle}</p>{universe?.mode === "played" && <small>ใช้ข้อมูลย้อนหลังของหวยในรายการที่เล่นวันนี้</small>}</div></div>
          <span className={result.sufficient ? "ready" : "waiting"}>{universeBadge}</span>
        </header>
        <div className="global-daily-hero-body">
          <div className="global-win-primary">
            <strong className="global-win-label">ชุดเลขประจำวัน (Global Win)</strong>
            <div className="global-win-digits" aria-label={`วินรวมทุกหวย ${digits.join(" ")}`}>
              {digits.map((digit) => <strong key={digit}>{digit}</strong>)}
            </div>
          </div>
          <div className="global-win-size-wrap"><span>ขนาดชุดเลข</span><div className="global-win-size" role="group" aria-label="จำนวนเลขวินรวมทุกหวย">
            {([5, 6, 7] as const).map((size) => <button key={size} type="button" className={winSize === size ? "active" : ""} aria-pressed={winSize === size} onClick={() => { setWinSize(size); setShowPairs(false); setCopied(null); }}>{size}</button>)}
          </div><small>เลือกจำนวนอันดับที่ต้องการ</small></div>
        </div>
        <div className="global-win-meta">
          <article><CalendarDays /><div><span>{result.weekdayLabel}</span><small>{result.cutoffDate}</small></div></article>
          <article><Database /><div><span>ใช้ข้อมูล {result.lotteryCount} หวย</span><small>บน {result.topDrawCount} · ล่าง {result.bottomDrawCount} งวด</small></div></article>
          <article><FileWarning /><div><span>ไม่ถูกใช้ {excluded} หวย</span><small>ตามเกณฑ์ข้อมูลและสถานะต้นทาง</small></div></article>
        </div>
        <div className="global-win-hero-actions">
          <button type="button" onClick={() => copyValues("digits", digits)}>{copied === "digits" ? <Check /> : <Copy />}{copied === "digits" ? "คัดลอกแล้ว" : `คัดลอก ${winSize} ตัว`}</button>
          <button type="button" className="global-win-copy-pairs" aria-expanded={showPairs} aria-controls="global-win-pair-space" onClick={() => setShowPairs((visible) => !visible)}>ดูชุดทั้งหมด {winSet.uniquePairsWithDoubles.length} คู่<ChevronDown className={showPairs ? "open" : ""} /></button>
        </div>
        {showPairs && <div className="global-win-pair-space" id="global-win-pair-space">
          <div><span>คู่ไม่เบิ้ล · {winSet.uniquePairs.length} คู่</span><div className="global-win-pair-list">{winSet.uniquePairs.map((pair) => <b key={pair}>{pair}</b>)}</div></div>
          <div><span>เลขเบิ้ล · {winSet.doubles.length} คู่</span><div className="global-win-pair-list doubles">{winSet.doubles.map((pair) => <b key={pair}>{pair}</b>)}</div></div>
          <button type="button" onClick={() => copyValues("pairs", winSet.uniquePairsWithDoubles)}>{copied === "pairs" ? <Check /> : <Copy />}{copied === "pairs" ? "คัดลอกแล้ว" : `คัดลอกทั้งหมด ${winSet.uniquePairsWithDoubles.length} คู่`}</button>
        </div>}
      </section>
      <div className="global-win-frequent-pairs">
        <header>
          <div><span aria-hidden="true"><KeyRound /></span><div><strong>ชุดวิน 6 — 15 คู่ + 6 เบิ้ล</strong><small>แตกคู่จากวิน 6 ตัวหลักของวันนี้</small></div></div>
          <span className="global-win-pair-badge">ชุดหลัก</span>
        </header>
        <div className="global-win-frequent-pair-groups" aria-label={`ชุดวิน 6 ${win6PairSet.nonDoublePairs.join(" ")} เบิ้ล ${win6PairSet.doubles.join(" ")}`}>
          <div className="global-win-frequent-pair-block">
            <span>คู่กลับ {win6PairSet.nonDoublePairs.length} คู่</span>
            <div className="global-win-frequent-pair-list">{win6PairSet.nonDoublePairs.map((pair) => <b key={pair}>{pair}</b>)}</div>
          </div>
          <div className="global-win-frequent-pair-block doubles">
            <span>เลขเบิ้ล {win6PairSet.doubles.length} ตัว</span>
            <div className="global-win-frequent-pair-list doubles">{win6PairSet.doubles.map((pair) => <span key={pair}><b>{pair}</b></span>)}</div>
          </div>
        </div>
        <div className="global-win-frequent-pair-footer">
          <button className="primary" type="button" onClick={() => copyValues("win6Pairs", win6CanonicalItems)}>{copied === "win6Pairs" ? <Check /> : <Copy />}{copied === "win6Pairs" ? "คัดลอกแล้ว" : "คัดลอก 15 คู่ + 6 เบิ้ล"}</button>
          <button type="button" onClick={() => copyValues("win6Expanded", [...win6PairSet.expandedNumbers])}>{copied === "win6Expanded" ? <Check /> : <Copy />}{copied === "win6Expanded" ? "คัดลอกแล้ว" : `คัดลอกชุดเล่น ${win6PairSet.expandedNumbers.length} เลข`}</button>
        </div>
        <small className="global-win-primary-pairs-note">15 คู่กลับ + 6 เบิ้ล · ชุดเล่นคือคู่กลับสองทิศทางรวมเบิ้ล ({win6PairSet.expandedNumbers.length} เลข)</small>
      </div>
      <div className="global-win-evidence-pairs">
        <header>
          <div><span aria-hidden="true"><KeyRound /></span><div><strong>คู่เด่นจากสถิติย้อนหลัง</strong><small>ข้อมูลประกอบการตัดสินใจ ไม่ใช่ชุดหลัก</small></div></div>
        </header>
        <div className="global-win-frequent-pair-groups" aria-label={`คู่เด่นจากสถิติย้อนหลัง ${recommendedPairs.slice(0, 21).map((item) => item.pair).join(" ")}`}>
          <div className="global-win-frequent-pair-block focused">
            <span>เน้นพิเศษ 10 คู่</span>
            <div className="global-win-frequent-pair-list focused">{focusedPairs.map((item, index) => <span key={item.pair}><b>{item.pair}</b><small>#{index + 1}</small></span>)}</div>
          </div>
          <div className="global-win-frequent-pair-block">
            <span>คู่หลักที่เหลือ {restPairs.length} คู่</span>
            <div className="global-win-frequent-pair-list">{restPairs.map((item) => <b key={item.pair}>{item.pair}</b>)}</div>
          </div>
          {result.frequentDoubles.length > 0 && <div className="global-win-frequent-pair-block doubles">
            <span>เลขเบิ้ลเด่น</span>
            <div className="global-win-frequent-pair-list doubles" aria-label={`เลขเบิ้ลเด่น ${result.frequentDoubles.map((item) => item.pair).join(" ")}`}>{result.frequentDoubles.map((item, index) => <span key={item.pair}><b>{item.pair}</b><small>#{index + 1}</small></span>)}</div>
          </div>}
        </div>
        <div className="global-win-frequent-pair-footer">
          <details className="global-win-pair-more-options">
            <summary>ตัวเลือกคัดลอก<ChevronDown /></summary>
            <div>
              <button type="button" onClick={() => copyValues("frequentTop10", pairsWithDoubles(10))}>{copied === "frequentTop10" ? <Check /> : <Copy />}{copied === "frequentTop10" ? "คัดลอกแล้ว" : "10 คู่ + เบิ้ล"}</button>
              <button type="button" onClick={() => copyValues("frequentTop15", pairsWithDoubles(15))}>{copied === "frequentTop15" ? <Check /> : <Copy />}{copied === "frequentTop15" ? "คัดลอกแล้ว" : "15 คู่ + เบิ้ล"}</button>
              <button type="button" onClick={() => copyValues("frequentTop21", pairsWithDoubles(21))}>{copied === "frequentTop21" ? <Check /> : <Copy />}{copied === "frequentTop21" ? "คัดลอกแล้ว" : "21 คู่ + เบิ้ล"}</button>
              <button type="button" onClick={() => copyValues("frequentPairs", pairsWithDoubles(50))}>{copied === "frequentPairs" ? <Check /> : <Copy />}{copied === "frequentPairs" ? "คัดลอกแล้ว" : "50 คู่ + เบิ้ล"}</button>
              {result.frequentDoubles.length > 0 && <button type="button" onClick={() => copyValues("frequentDoubles", result.frequentDoubles.map((item) => item.pair))}>{copied === "frequentDoubles" ? <Check /> : <Copy />}{copied === "frequentDoubles" ? "คัดลอกแล้ว" : "เฉพาะเลขเบิ้ล"}</button>}
            </div>
          </details>
        </div>
      </div>
      <section className="global-win-pair-derived"><header><KeyRound /><div><strong>ชุดเลขจาก 21 คู่แรก (Win 6)</strong><span>ชุดสำรวจจาก 21 คู่ที่พบบ่อย ไม่ใช่ชุดหลัก</span></div></header><div className="global-win-pair-derived-digits" aria-label={`วิน 6 จากคู่เน้น ${result.pairDerivedDigits.map((item) => item.digit).join(" ")}`}>{result.pairDerivedDigits.map((item) => <b key={item.digit}>{item.digit}</b>)}</div><button type="button" onClick={() => copyValues("pairDigits", result.pairDerivedDigits.map((item) => item.digit))}>{copied === "pairDigits" ? <Check /> : <Copy />}{copied === "pairDigits" ? "คัดลอกแล้ว" : "คัดลอกชุดจาก 21 คู่แรก"}</button></section>
      {!result.sufficient && <p className="global-win-warning">ข้อมูลรวมยังน้อย ชุดนี้ใช้สำรวจเท่านั้น</p>}
      <details className="global-win-method"><summary><CircleHelp />โครงสร้างคะแนน และรายละเอียดการคำนวณ<ChevronDown /></summary><div><p>{formatRankBoundaryGap(result.scoreDistribution.rank6To7Gap)}</p><p>ย้อนหลังสูงสุด {result.lookbackPerLottery} {result.weekdayLabel}ต่อหวย · ไม่นับผลวันนี้ · บน–ล่างน้ำหนักเท่ากัน</p></div></details>
      <p className="global-win-disclaimer">ตัวเลขทั้งหมดมาจากสถิติย้อนหลัง ใช้เพื่อสำรวจข้อมูล ไม่ใช่ค่าความน่าจะเป็นของงวดถัดไป</p>
      </>;
    })()}
  </section>;
}
