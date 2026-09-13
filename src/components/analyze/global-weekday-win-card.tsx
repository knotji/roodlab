"use client";

import { CalendarDays, Check, ChevronDown, CircleHelp, Copy, Database, FileWarning, Globe2, KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import type { GlobalWeekdayWinResult } from "@/lib/analysis/global-weekday-win";
import { CURRENT_GLOBAL_WIN6_EVIDENCE } from "@/lib/analysis/global-production-evidence-summary";
import { formatRankBoundaryGap } from "@/lib/analysis/global-score-distribution";
import { buildWinSet, deriveWin6PairSet } from "@/lib/analysis/win-set";

type GlobalUniverseMeta = { mode: "locked" | "today_eligible"; weekday: number; configuredCount: number; eligibleCount: number };
type DailyScope = { targetDate: string; targetCount: number; historicalTargetCount: number; targets:Array<{lotteryId:string;name:string;resultAt:string}>; scheduleLimitations: Array<{ lotteryId: string; name: string }>; sourceExclusions: Array<{ lotteryId: string; reason?: string }>; lockPlan: { deadlineBangkok: string | null; firstResultAt: string | null; exactDeadlineKnown: boolean } };
type LockedMode = { digits:string[];configuredCount:number;eligibleCount:number;historyVersion:string;contributorLotteryIds?:string[] };
type PrelockSyncRun = {status:"running"|"ready"|"not-ready"|"failed";successCount:number;failedCount:number;completedAt:string|null};
type DailyLock = { status: "locked"; record: { modes:{a:LockedMode;b:LockedMode};targetLotteryIds:string[]; createdAt: string; targetDate:string; formulaVersion: string; historyVersion: string; deadlineBangkok:string } } | { status: "preview"|"missing-after-deadline"; persistenceAvailable: boolean; authorizationConfigured:boolean;allowed: boolean; reason?: string;previewFingerprint:string;previewSignature:string|null;pairedPreview:{targets:string[];modes:{a:LockedMode;b:LockedMode}};prelockSync:PrelockSyncRun|null };
type GlobalDailyResult = GlobalWeekdayWinResult & { universe?: GlobalUniverseMeta; dailyScope?: DailyScope; dailyLock?: DailyLock };
type ApiResult = ({ ok: true } & GlobalDailyResult) | { ok: false; error: string };

export function GlobalWeekdayWinCard({ onCutoffDateChange }: { onCutoffDateChange?: (date: string) => void } = {}) {
  const [result, setResult] = useState<GlobalDailyResult | null>(null),
    [error, setError] = useState<string | null>(null),
    [universeMode, setUniverseMode] = useState<"locked" | "today">("locked"),
    [winSize, setWinSize] = useState<5 | 6 | 7>(7),
    [lockSecret,setLockSecret]=useState(""),[locking,setLocking]=useState(false),[lockError,setLockError]=useState<string|null>(null),
    [showPairs, setShowPairs] = useState(false),
    [copied, setCopied] = useState<"digits" | "pairs" | "pairDigits" | "frequentDoubles" | "frequentTop10" | "frequentTop15" | "frequentTop18" | "frequentPairs" | "win6Pairs" | "win6Expanded" | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/global-weekday-win?universe=${universeMode}`)
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
  }, [onCutoffDateChange, universeMode]);

  async function confirmDailyLock(){
    if(!result||result.dailyLock?.status!=="preview")return;
    setLocking(true);setLockError(null);
    try{const response=await fetch("/api/global-weekday-win",{method:"POST",headers:{"content-type":"application/json","x-daily-lock-secret":lockSecret},body:JSON.stringify({previewFingerprint:result.dailyLock.previewFingerprint,previewSignature:result.dailyLock.previewSignature})}),data=await response.json() as {ok:boolean;error?:string};if(!response.ok||!data.ok)throw new Error(data.error??"บันทึกชุดไม่สำเร็จ");
      const refreshed=await fetch(`/api/global-weekday-win?universe=${universeMode}`),next=await refreshed.json() as ApiResult;if(!refreshed.ok||!next.ok)throw new Error("บันทึกแล้วแต่โหลดชุดที่ยืนยันไม่สำเร็จ");setResult(next);setLockSecret("");
    }catch(reason){setLockError(reason instanceof Error?reason.message:"บันทึกชุดไม่สำเร็จ")}finally{setLocking(false)}
  }

  async function copyValues(mode: "digits" | "pairs" | "pairDigits" | "frequentDoubles" | "frequentTop10" | "frequentTop15" | "frequentTop18" | "frequentPairs" | "win6Pairs" | "win6Expanded", values: string[]) {
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
      const lockedMode=result.dailyLock?.status==="locked"?(universeMode==="locked"?result.dailyLock.record.modes.a:result.dailyLock.record.modes.b):null,
        lockedDigits = lockedMode?.digits ?? null,
        digits = lockedDigits && universeMode === "locked" && winSize === 6 ? lockedDigits : result.rankedDigits.slice(0, winSize).map((item) => item.digit),
        winSet = buildWinSet(digits, winSize),
        productionWin6 = lockedDigits ?? result.digits.map((item) => item.digit),
        win6PairSet = deriveWin6PairSet(productionWin6),
        win6CanonicalItems = [...win6PairSet.nonDoublePairs, ...win6PairSet.doubles],
        recommendedPairs = result.frequentPairs.filter((item) => item.pair[0] !== item.pair[1]),
        shownRecommendedPairs = recommendedPairs.slice(0, 18),
        focusedPairs = shownRecommendedPairs.slice(0, 10),
        restPairs = shownRecommendedPairs.slice(10),
        recommendedDoubles = result.frequentDoubles.slice(0, 4),
        pairsWithDoubles = (size: number) => [...new Set([
          ...recommendedPairs.slice(0, size).map((item) => item.pair),
          ...recommendedDoubles.map((item) => item.pair),
        ])];
      const totalCatalog = result.eligibility?.totalCatalog ?? result.sourcePoolCount,
        excluded = Math.max(0, totalCatalog - result.lotteryCount),
        universe = result.universe,
        heroSubtitle = universe?.mode === "today_eligible" ? "ทดลองคำนวณจากหวยที่มีกำหนดออกวันนี้และผ่านเกณฑ์" : "คำนวณด้วยขอบเขตแหล่งข้อมูลเดิม (ค่าเริ่มต้น)",
        effectiveEligibleCount=lockedMode?.eligibleCount ?? universe?.eligibleCount ?? result.lotteryCount,
        universeBadge = `เป้าหมายวันนี้ ${result.dailyScope?.targetCount ?? 0} หวย · ร่วมคำนวณ ${effectiveEligibleCount} หวย`,
        isActualLock = result.dailyLock?.status === "locked" && universeMode === "locked" && winSize === 6;
      return <>
      <section className="global-daily-hero">
        <header className="global-daily-header">
          <div className="global-daily-title"><span aria-hidden="true"><Globe2 /></span><div><h3 id="global-win-heading">Global Daily</h3><p>{heroSubtitle}</p><small>{isActualLock ? "ชุดล็อกจริง · ใช้ชุดเดิมตลอดวัน" : "ชุดทดลอง / preview · ยังไม่ใช่หลักฐานก่อนออกรางวัล"}</small></div></div>
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
        <div className="global-universe-selector" role="group" aria-label="ขอบเขตหวยรอบโลก">
          <span>ขอบเขตข้อมูล</span>
          <div>
            <button type="button" className={universeMode === "locked" ? "active" : ""} aria-pressed={universeMode === "locked"} onClick={() => { setError(null); setUniverseMode("locked"); }}>แหล่งเดิม (ค่าเริ่มต้น)</button>
            <button type="button" className={universeMode === "today" ? "active" : ""} aria-pressed={universeMode === "today"} onClick={() => { setError(null); setUniverseMode("today"); }}>หวยที่ออกวันนี้</button>
          </div>
        </div>
        {result.dailyScope && <details className="global-win-method"><summary><CircleHelp />ขอบเขตชุดประจำวันและข้อมูลที่ไม่พร้อม<ChevronDown /></summary><div>
          <p>หวยเป้าหมาย {result.dailyScope.targetCount} หวย · แหล่งร่วมคำนวณ {effectiveEligibleCount} หวย · ข้อมูลไม่พอ {result.dailyScope.sourceExclusions.length} หวย</p>
          <p>เป้าหมาย: {result.dailyScope.targets.map(item=>`${item.name} ${item.resultAt}`).join(", ")}</p>
          <p>แหล่งคำนวณ: {(lockedMode?.contributorLotteryIds ?? (result.dailyLock?.status==="preview"?(universeMode==="locked"?result.dailyLock.pairedPreview.modes.a.contributorLotteryIds:result.dailyLock.pairedPreview.modes.b.contributorLotteryIds)??[]:[])).join(", ") || "--"}</p>
          {result.dailyScope.sourceExclusions.length > 0 && <p>{result.dailyScope.sourceExclusions.map((item) => `${item.lotteryId}: ${item.reason ?? "ไม่ผ่านเกณฑ์ข้อมูล"}`).join(" · ")}</p>}
          {result.dailyScope.scheduleLimitations.length > 0 && <p>ยังไม่ใช้ประเมินย้อนหลัง {result.dailyScope.scheduleLimitations.map((item) => item.name).join(", ")} เพราะเวลาออกหลังเที่ยงคืนยังยืนยันขอบเขตวันที่ของต้นทางไม่ได้</p>}
          <p>{result.dailyScope.lockPlan.exactDeadlineKnown ? `กำหนดล็อก ${result.dailyScope.lockPlan.deadlineBangkok}` : `ต้องล็อกก่อนผลแรก ${result.dailyScope.lockPlan.firstResultAt ?? "--"} · ยังยืนยันเวลาปิดที่แน่นอนไม่ได้`}</p>
        </div></details>}
        <div className="global-win-meta">
          <article><CalendarDays /><div><span>{result.weekdayLabel}</span><small>{result.cutoffDate}</small></div></article>
          <article><Database /><div><span>ใช้ข้อมูล {result.lotteryCount} หวย</span><small>บน {result.topDrawCount} · ล่าง {result.bottomDrawCount} งวด</small></div></article>
          <article><FileWarning /><div><span>ไม่ถูกใช้ {excluded} หวย</span><small>ตามเกณฑ์ข้อมูลและสถานะต้นทาง</small></div></article>
        </div>
        <div className="global-win-hero-actions">
          <button type="button" onClick={() => copyValues("digits", digits)}>{copied === "digits" ? <Check /> : <Copy />}{copied === "digits" ? "คัดลอกแล้ว" : `คัดลอก ${winSize} ตัว`}</button>
          <button type="button" className="global-win-copy-pairs" aria-expanded={showPairs} aria-controls="global-win-pair-space" onClick={() => setShowPairs((visible) => !visible)}>ดูชุดทั้งหมด {winSet.uniquePairsWithDoubles.length} คู่<ChevronDown className={showPairs ? "open" : ""} /></button>
        </div>
        {result.dailyLock?.status==="preview"&&<div className="global-daily-lock-action"><label htmlFor="daily-lock-secret">ยืนยันล็อก A และ B พร้อมกัน</label><p className={result.dailyLock.prelockSync?.status==="ready"?"global-win-ready":"global-win-warning"}>{result.dailyLock.prelockSync?.status==="ready"?`ข้อมูลก่อนล็อกพร้อม · สำเร็จ ${result.dailyLock.prelockSync.successCount} หวย`:`ยังล็อกไม่ได้ · การซิงก์ก่อนล็อกยังไม่พร้อม${result.dailyLock.prelockSync?.failedCount?` · ล้มเหลว ${result.dailyLock.prelockSync.failedCount} หวย`:""}`}</p><div className="global-daily-lock-preview"><article><span>A · แหล่งเดิม</span><b>{result.dailyLock.pairedPreview.modes.a.digits.join(" · ")}</b><small>{result.dailyLock.pairedPreview.modes.a.eligibleCount} แหล่งร่วมคำนวณ</small></article><article><span>B · หวยที่ออกวันนี้</span><b>{result.dailyLock.pairedPreview.modes.b.digits.join(" · ")}</b><small>{result.dailyLock.pairedPreview.modes.b.eligibleCount} แหล่งร่วมคำนวณ</small></article></div><div><input id="daily-lock-secret" type="password" autoComplete="current-password" value={lockSecret} onChange={event=>setLockSecret(event.target.value)} placeholder="รหัสสำหรับล็อกชุด"/><button type="button" disabled={locking||!lockSecret||!result.dailyLock.persistenceAvailable||!result.dailyLock.authorizationConfigured||!result.dailyLock.previewSignature||result.dailyLock.prelockSync?.status!=="ready"} onClick={confirmDailyLock}>{locking?"กำลังบันทึก…":"ล็อกวิน 6 ทั้งสองโหมด"}</button></div><small>ทั้งสองชุดมาจาก snapshot เดียวกัน ระบบจะตรวจ deadline, readiness และ fingerprint ซ้ำบน server ก่อนบันทึก record เดียว</small>{lockError&&<p role="alert">{lockError}</p>}</div>}
        {result.dailyLock?.status==="missing-after-deadline"&&<p className="global-win-warning">ไม่มีชุดล็อกสำหรับวันนี้ · ผ่านเวลาล็อกแล้ว และจะไม่นำ preview มาแสดงเป็นชุดจริง</p>}
        {result.dailyLock?.status==="locked"&&<div className="global-daily-lock-record"><strong>ชุดล็อกจริง</strong><span>ล็อกเมื่อ {new Date(result.dailyLock.record.createdAt).toLocaleString("th-TH",{timeZone:"Asia/Bangkok"})}</span><small>วันที่ {result.dailyLock.record.targetDate} · data {result.dailyLock.record.historyVersion.slice(0,8)} · formula {result.dailyLock.record.formulaVersion}</small></div>}
        {showPairs && <div className="global-win-pair-space" id="global-win-pair-space">
          <div><span>คู่ไม่เบิ้ล · {winSet.uniquePairs.length} คู่</span><div className="global-win-pair-list">{winSet.uniquePairs.map((pair) => <b key={pair}>{pair}</b>)}</div></div>
          <div><span>เลขเบิ้ล · {winSet.doubles.length} คู่</span><div className="global-win-pair-list doubles">{winSet.doubles.map((pair) => <b key={pair}>{pair}</b>)}</div></div>
          <button type="button" onClick={() => copyValues("pairs", winSet.uniquePairsWithDoubles)}>{copied === "pairs" ? <Check /> : <Copy />}{copied === "pairs" ? "คัดลอกแล้ว" : `คัดลอกทั้งหมด ${winSet.uniquePairsWithDoubles.length} คู่`}</button>
        </div>}
      </section>
      <div className="global-win-frequent-pairs">
        <header>
          <div><span aria-hidden="true"><KeyRound /></span><div><strong>คู่เด่นจากสถิติย้อนหลัง</strong><small>คู่ไม่เบิ้ล 18 คู่ · เบิ้ล 4 คู่</small></div></div>
          <span className="global-win-pair-badge">ชุดหลัก</span>
        </header>
        <div className="global-win-frequent-pair-groups" aria-label={`คู่เด่นจากสถิติย้อนหลัง ${shownRecommendedPairs.map((item) => item.pair).join(" ")} เบิ้ล ${recommendedDoubles.map((item) => item.pair).join(" ")}`}>
          <div className="global-win-frequent-pair-block focused">
            <span>เน้นพิเศษ 10 คู่</span>
            <div className="global-win-frequent-pair-list focused">{focusedPairs.map((item, index) => <span key={item.pair}><b>{item.pair}</b><small>#{index + 1}</small></span>)}</div>
          </div>
          <div className="global-win-frequent-pair-block">
            <span>คู่ไม่เบิ้ลที่เหลือ {restPairs.length} คู่</span>
            <div className="global-win-frequent-pair-list">{restPairs.map((item) => <b key={item.pair}>{item.pair}</b>)}</div>
          </div>
          {recommendedDoubles.length > 0 && <div className="global-win-frequent-pair-block doubles">
            <span>เลขเบิ้ล · {recommendedDoubles.length} คู่</span>
            <div className="global-win-frequent-pair-list doubles" aria-label={`เลขเบิ้ลเด่น ${recommendedDoubles.map((item) => item.pair).join(" ")}`}>{recommendedDoubles.map((item, index) => <span key={item.pair}><b>{item.pair}</b><small>#{index + 1}</small></span>)}</div>
          </div>}
        </div>
        <div className="global-win-frequent-pair-footer">
          <button className="primary" type="button" onClick={() => copyValues("frequentTop18", pairsWithDoubles(18))}>{copied === "frequentTop18" ? <Check /> : <Copy />}{copied === "frequentTop18" ? "คัดลอกแล้ว" : "คัดลอก 18 คู่ + 4 เบิ้ล"}</button>
          <details className="global-win-pair-more-options">
            <summary>ตัวเลือกคัดลอก<ChevronDown /></summary>
            <div>
              <button type="button" onClick={() => copyValues("frequentTop10", pairsWithDoubles(10))}>{copied === "frequentTop10" ? <Check /> : <Copy />}{copied === "frequentTop10" ? "คัดลอกแล้ว" : "10 คู่ + เบิ้ล"}</button>
              <button type="button" onClick={() => copyValues("frequentTop15", pairsWithDoubles(15))}>{copied === "frequentTop15" ? <Check /> : <Copy />}{copied === "frequentTop15" ? "คัดลอกแล้ว" : "15 คู่ + เบิ้ล"}</button>
              <button type="button" onClick={() => copyValues("frequentPairs", pairsWithDoubles(50))}>{copied === "frequentPairs" ? <Check /> : <Copy />}{copied === "frequentPairs" ? "คัดลอกแล้ว" : "50 คู่ + เบิ้ล"}</button>
              {recommendedDoubles.length > 0 && <button type="button" onClick={() => copyValues("frequentDoubles", recommendedDoubles.map((item) => item.pair))}>{copied === "frequentDoubles" ? <Check /> : <Copy />}{copied === "frequentDoubles" ? "คัดลอกแล้ว" : "เฉพาะเลขเบิ้ล"}</button>}
            </div>
          </details>
        </div>
      </div>
      <details className="global-win-secondary">
        <summary><span><KeyRound />ชุดวิน 6 และชุดสำรวจเพิ่มเติม</span><small>ไม่ใช่ชุดหลัก</small><ChevronDown /></summary>
        <div className="global-win-secondary-content">
      <div className="global-win-evidence-pairs">
        <header>
          <div><span aria-hidden="true"><KeyRound /></span><div><strong>ชุดวิน 6 — 15 คู่ + 6 เบิ้ล</strong><small>แตกคู่จากวิน 6 ตัวหลักของวันนี้ · ไม่ใช่ชุดหลัก</small></div></div>
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
          <button type="button" onClick={() => copyValues("win6Pairs", win6CanonicalItems)}>{copied === "win6Pairs" ? <Check /> : <Copy />}{copied === "win6Pairs" ? "คัดลอกแล้ว" : "คัดลอก 15 คู่ + 6 เบิ้ล"}</button>
          <button type="button" onClick={() => copyValues("win6Expanded", [...win6PairSet.expandedNumbers])}>{copied === "win6Expanded" ? <Check /> : <Copy />}{copied === "win6Expanded" ? "คัดลอกแล้ว" : `คัดลอกชุดเล่น ${win6PairSet.expandedNumbers.length} เลข`}</button>
        </div>
        <small className="global-win-primary-pairs-note">15 คู่กลับ + 6 เบิ้ล · ชุดเล่นคือคู่กลับสองทิศทางรวมเบิ้ล ({win6PairSet.expandedNumbers.length} เลข)</small>
      </div>
      <section className="global-win-pair-derived"><header><KeyRound /><div><strong>ชุดเลขจาก 21 คู่แรก (Win 6)</strong><span>ชุดสำรวจจาก 21 คู่ที่พบบ่อย ไม่ใช่ชุดหลัก</span></div></header><div className="global-win-pair-derived-digits" aria-label={`วิน 6 จากคู่เน้น ${result.pairDerivedDigits.map((item) => item.digit).join(" ")}`}>{result.pairDerivedDigits.map((item) => <b key={item.digit}>{item.digit}</b>)}</div><button type="button" onClick={() => copyValues("pairDigits", result.pairDerivedDigits.map((item) => item.digit))}>{copied === "pairDigits" ? <Check /> : <Copy />}{copied === "pairDigits" ? "คัดลอกแล้ว" : "คัดลอกชุดจาก 21 คู่แรก"}</button></section>
        </div>
      </details>
      {!result.sufficient && <p className="global-win-warning">ข้อมูลรวมยังน้อย ชุดนี้ใช้สำรวจเท่านั้น</p>}
      {universeMode === "locked" && winSize === 6 ? <details className="global-win-evidence-summary">
        <summary><CircleHelp /><span>หลักฐานการประเมินย้อนหลัง</span><small>ยังไม่พบความได้เปรียบที่ชัดเจน</small><ChevronDown /></summary>
        <div>
          <p><strong>{(CURRENT_GLOBAL_WIN6_EVIDENCE.productionEitherRate * 100).toFixed(1)}%</strong><span>ผลย้อนหลัง</span><b>เทียบ</b><strong>{(CURRENT_GLOBAL_WIN6_EVIDENCE.exactRandomEitherRate * 100).toFixed(1)}%</strong><span>ค่าพื้นฐานแบบสุ่ม</span></p>
          <small>ขอบเขตชุดล็อก · วิน 6 · ข้อมูลถึง {CURRENT_GLOBAL_WIN6_EVIDENCE.evaluatedThrough} · ต่าง +{(CURRENT_GLOBAL_WIN6_EVIDENCE.uplift * 100).toFixed(2)} จุดเปอร์เซ็นต์ · ช่วงความเชื่อมั่นยังคร่อมศูนย์ · {CURRENT_GLOBAL_WIN6_EVIDENCE.outcomes.toLocaleString("th-TH")} ผล</small>
          <em>เป็นผลประเมินย้อนหลัง ไม่ใช่ค่าความแม่นหรือโอกาสของงวดถัดไป</em>
        </div>
      </details> : <details className="global-win-evidence-summary"><summary><CircleHelp /><span>หลักฐานการประเมินย้อนหลัง</span><small>ยังไม่มีผลประเมินสำหรับขอบเขตนี้</small><ChevronDown /></summary><div><em>โหมดนี้เป็นชุดทดลอง และยังไม่มีผลประเมินที่ใช้หวยเป้าหมายกับขอบเขตแหล่งข้อมูลตรงกัน</em></div></details>}
      <details className="global-win-method"><summary><CircleHelp />โครงสร้างคะแนน และรายละเอียดการคำนวณ<ChevronDown /></summary><div><p>{formatRankBoundaryGap(result.scoreDistribution.rank6To7Gap)}</p><p>ย้อนหลังสูงสุด {result.lookbackPerLottery} {result.weekdayLabel}ต่อหวย · ไม่นับผลวันนี้ · บน–ล่างน้ำหนักเท่ากัน</p></div></details>
      <p className="global-win-disclaimer">ตัวเลขทั้งหมดมาจากสถิติย้อนหลัง ใช้เพื่อสำรวจข้อมูล ไม่ใช่ค่าความน่าจะเป็นของงวดถัดไป</p>
      </>;
    })()}
  </section>;
}
