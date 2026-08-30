"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Snapshot, SnapshotFreshness } from "@/lib/cache";
import type { FreshnessInfo } from "@/lib/freshness";
import type { LotteryDefinition, LotteryDraw } from "@/lib/types";
import type {
  DigitSignal,
  DigitWeights,
  PairSignal,
  PairWeights,
  Side,
} from "@/lib/analysis/types";
import { analyzeLottery, positionMatrix } from "@/lib/analysis/engine";
import { memoizedAnalyze } from "@/lib/analysis/cache";
import { backtest, metric, referenceBaselines } from "@/lib/analysis/backtest";
import { compareAlgorithms } from "@/lib/analysis/formula-lab";
import { ALGORITHMS, validateWeights } from "@/lib/analysis/algorithms";
import {
  DAY_PATTERN_OPTIONS,
  MIN_DAY_PATTERN_DRAWS,
  dayPatternLabel,
  filterDrawsByDay,
  type DayPattern,
} from "@/lib/analysis/day-pattern";
import { getCanonicalDataset } from "@/lib/history-provider";
import { computeHistoryVersion } from "@/lib/history-version";
import {
  buildFocusedWinSet,
  buildTieredWinSet,
  buildWinSet,
} from "@/lib/analysis/win-set";
import {
  buildConsensus,
  buildDistributedConsensus,
  type ConsensusResult,
} from "@/lib/analysis/consensus";
import {
  buildDiversifiedWinSix,
  evaluateWinTracking,
  historicalWinCoverage,
  type WinTrackingMode,
} from "@/lib/analysis/win-strategy";
import type { DataIntegritySummary } from "@/lib/data-sources/integrity";
import type { ProspectiveRecord } from "@/lib/prospective";
import type { SystemStatus } from "@/lib/system-status";
import { resolveLotteryId, useLotteryStore } from "@/lib/lottery-store";
import { LotterySelector } from "./lottery-selector";
import { LotteryHeaderMeta, syncNeedsUpdate } from "./lottery-header-meta";
import { PairDiagnosticsPanel } from "./pair-diagnostics-panel";
import {
  Activity,
  BarChart3,
  Check,
  ClipboardCheck,
  Copy,
  Database,
  Download,
  History,
  Info,
  Minus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  TestTube2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
type Section = "analyze" | "prospective" | "statistics" | "history" | "backtest" | "settings";
const nav = [
  { id: "analyze", label: "วิเคราะห์", icon: Sparkles },
  { id: "prospective", label: "หลักฐาน", icon: ClipboardCheck },
  { id: "statistics", label: "สถิติ", icon: BarChart3 },
  { id: "history", label: "ย้อนหลัง", icon: History },
  { id: "backtest", label: "ทดสอบ", icon: TestTube2 },
  { id: "settings", label: "ตั้งค่า", icon: Settings },
] as const;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const thaiShortMonths = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
] as const;
function formatShortDrawDate(drawDate: string | undefined) {
  if (!drawDate) return "--";
  const [year, month, day] = drawDate.split("-").map(Number);
  if (!year || !month || !day || !thaiShortMonths[month - 1]) return drawDate;
  return `${day} ${thaiShortMonths[month - 1]} ${year + 543}`;
}
const defaultDigit: DigitWeights = {
    frequency: 0.3,
    recentFrequency: 0.25,
    momentum: 0.2,
    positionStrength: 0.15,
    gapPattern: 0.1,
  },
  defaultPair: PairWeights = {
    digitA: 0.25,
    digitB: 0.25,
    pairFrequency: 0.2,
    recentPairTrend: 0.15,
    positionMatch: 0.15,
  };
export default function Dashboard({
  catalog: initialCatalog,
  initialSnapshots,
  auditStatuses,
}: {
  catalog: LotteryDefinition[];
  initialSnapshots: Record<string, Snapshot>;
  auditStatuses: Record<
    string,
    { status: "supported" | "partial" | "failed"; reason?: string }
  >;
}) {
  const stored = useLotteryStore((s) => s.selectedLotteryId),
    persistLottery = useLotteryStore((s) => s.setSelectedLottery),
    algorithmId = useLotteryStore((s) => s.algorithmId),
    setAlgorithm = useLotteryStore((s) => s.setAlgorithm);
  const [catalog, setCatalog] = useState(initialCatalog),
    [snapshots, setSnapshots] = useState(initialSnapshots),
    [selectedId, setSelectedId] = useState(initialCatalog[0]?.id ?? ""),
    [section, setSection] = useState<Section>("analyze"),
    [windowSize, setWindow] = useState(30),
    [candidateCount, setCandidateCount] = useState(4),
    [doubles, setDoubles] = useState(true),
    [syncing, setSyncing] = useState(false),
    [catalogSync, setCatalogSync] = useState(false),
    [error, setError] = useState<string | null>(null),
    [digitDetail, setDigitDetail] = useState<DigitSignal | null>(null),
    [pairDetail, setPairDetail] = useState<PairSignal | null>(null),
    [fullAnalysis, setFullAnalysis] = useState(false),
    [search, setSearch] = useState(""),
    [visible, setVisible] = useState(20),
    [testDraws, setTestDraws] = useState(30),
    [backtestTab, setBacktestTab] = useState<"results" | "lab">("results"),
    [formulaDayPattern, setFormulaDayPattern] = useState<DayPattern>("all"),
    [expandedRow, setExpandedRow] = useState<string | null>(null),
    [positionSide, setPositionSide] = useState<Side>("top"),
    [gapSort, setGapSort] = useState<"score" | "latest" | "gap">("score"),
    [dayPattern, setDayPattern] = useState<DayPattern>("all"),
    [digitWeights, setDigitWeights] = useState(defaultDigit),
    [pairWeights, setPairWeights] = useState(defaultPair),
    [liveFreshness, setLiveFreshness] = useState<FreshnessInfo | null>(null),
    [syncNotice, setSyncNotice] = useState<{
      addedDraws: number;
      latest: string;
    } | null>(null),
    [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null),
    [hydrated, setHydrated] = useState(false);
  const loadSystemStatus = () =>
    fetch("/api/system/status")
      .then((response) => response.json())
      .then((data) => {
        if (data.ok) setSystemStatus(data as SystemStatus);
      })
      .catch(() => setSystemStatus(null));
  useEffect(() => {
    void loadSystemStatus();
  }, []);
  useEffect(() => {
    void Promise.resolve(useLotteryStore.persist.rehydrate()).finally(() =>
      setHydrated(true),
    );
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href).searchParams.get("lottery"),
      resolved = resolveLotteryId(
        catalog.map((x) => x.id),
        stored,
        url,
      );
    if (resolved && resolved !== selectedId)
      queueMicrotask(() => {
        setSelectedId(resolved);
        persistLottery(resolved);
      });
  }, [catalog, stored, selectedId, persistLottery]);
  const selectLottery = (id: string) => {
    setSelectedId(id);
    persistLottery(id);
    setError(null);
    setDigitDetail(null);
    setPairDetail(null);
    setExpandedRow(null);
    setSearch("");
    setVisible(20);
    setSyncNotice(null);
    setLiveFreshness(null);
    const url = new URL(location.href);
    url.searchParams.set("lottery", id);
    history.replaceState({}, "", url);
  };
  const snapshot = snapshots[selectedId],
    canonical = useMemo(
      () => getCanonicalDataset(snapshot, windowSize),
      [snapshot, windowSize],
    ),
    draws = canonical.history,
    analysisDraws = canonical.analysisHistory,
    patternDraws = filterDrawsByDay(analysisDraws, dayPattern),
    formulaDraws = filterDrawsByDay(analysisDraws, formulaDayPattern),
    integrity = canonical.integrity,
    freshness = liveFreshness ?? snapshot?.freshness ?? null,
    hasSignals =
      analysisDraws.some((d) => d.top3 || d.top2 || d.bottom2) &&
      auditStatuses[selectedId]?.status !== "failed",
    customValid = validateWeights(digitWeights) && validateWeights(pairWeights);
  const analysis = useMemo(() => {
    return hasSignals
      ? memoizedAnalyze(selectedId, patternDraws, {
          window: windowSize,
          candidateCount,
          includeDoubles: doubles,
          algorithmId: algorithmId === "custom" ? "balanced-v1" : algorithmId,
        })
      : null;
  }, [
    selectedId,
    patternDraws,
    hasSignals,
    windowSize,
    candidateCount,
    doubles,
    algorithmId,
  ]);
  const consensus = useMemo(
    () =>
      hasSignals
        ? buildConsensus(patternDraws, {
            window: windowSize,
            candidateCount,
            includeDoubles: doubles,
          })
        : null,
    [patternDraws, hasSignals, windowSize, candidateCount, doubles],
  );
  const tests = useMemo(() => {
      return hasSignals
        ? backtest(
            analysisDraws,
            windowSize,
            testDraws,
            candidateCount,
            "balanced-v1",
          )
        : [];
    }, [analysisDraws, hasSignals, windowSize, testDraws, candidateCount]),
    comparisons = useMemo(
      () =>
        hasSignals
          ? compareAlgorithms(
              formulaDraws,
              windowSize,
              testDraws,
              candidateCount,
            )
          : [],
      [formulaDraws, hasSignals, windowSize, testDraws, candidateCount],
    );
  async function sync() {
    setSyncing(true);
    setError(null);
    setSyncNotice(null);
    try {
      const r = await fetch(`/api/history/${selectedId}`, { method: "POST" }),
        data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setSnapshots((s) => ({ ...s, [selectedId]: data }));
      const nextFreshness = data.freshness as SnapshotFreshness | undefined;
      setLiveFreshness(nextFreshness ?? null);
      setSyncNotice({
        addedDraws: data.addedDraws ?? 0,
        latest: data.draws?.[0]?.drawDate ?? data.cachedLatestDrawDate ?? "",
      });
      void loadSystemStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ซิงก์ไม่สำเร็จ");
    } finally {
      setSyncing(false);
    }
  }
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    fetch(`/api/history/${selectedId}/freshness`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.ok) {
          setLiveFreshness(data.freshness as FreshnessInfo);
        }
      })
      .catch(() => {
        if (!cancelled) setLiveFreshness(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);
  async function refreshCatalog() {
    setCatalogSync(true);
    try {
      const r = await fetch("/api/catalog", { method: "POST" }),
        data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setCatalog(data.lotteries);
    } catch (e) {
      setError(e instanceof Error ? e.message : "รีเฟรชรายการไม่สำเร็จ");
    } finally {
      setCatalogSync(false);
    }
  }
  const latest = draws[0]?.drawDate,
    filtered = draws.filter((d) =>
      `${d.drawDate} ${d.top3} ${d.top2} ${d.bottom2}`.includes(search),
    );
  const selectFormulaDayPattern = (nextDay: DayPattern) => {
    const matchingDraws = filterDrawsByDay(analysisDraws, nextDay).length;
    setFormulaDayPattern(nextDay);
    if (nextDay === "all" || matchingDraws > windowSize) return;
    const usableWindow = [50, 30, 20, 10].find(
      (candidate) => candidate < matchingDraws,
    );
    if (usableWindow) setWindow(usableWindow);
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span>R</span>
          <div>
            <strong>RoodLab</strong>
            <small>Signal analysis</small>
          </div>
        </div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              className={section === n.id ? "active" : ""}
              onClick={() => setSection(n.id)}
            >
              <n.icon />
              {n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <Database />
          <div>
            <strong>{systemStatus?.connected ? "Neon connected" : `${draws.length} งวด`}</strong>
            <small>{systemStatus?.connected ? `${systemStatus.snapshotCount} หวย · ล็อกล่วงหน้า ${systemStatus.predictionCount}` : snapshot ? "JSON fallback · ข้อมูลจาก AllHuay" : "ยังไม่มี cache"}</small>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="topbar-head">
            <div className="eyebrow">LOTTERY ANALYSIS</div>
            <LotterySelector
              catalog={catalog}
              selectedId={selectedId}
              onSelect={selectLottery}
              onRefresh={refreshCatalog}
              refreshing={catalogSync}
              auditStatuses={auditStatuses}
            />
            <LotteryHeaderMeta
              windowSize={windowSize}
              latestDrawDate={latest}
              syncedAt={snapshot?.syncedAt}
              freshness={freshness}
              syncNotice={syncNotice}
              currentSourceResultDate={snapshot?.currentSourceResultDate}
              latestCompleteDrawDate={snapshot?.latestCompleteDrawDate}
              integrity={integrity}
              hydrated={hydrated}
            />
          </div>
          <div className={`storage-badge ${systemStatus?.connected ? "connected" : "fallback"}`} title={systemStatus?.connected ? `Neon · ${systemStatus.snapshotCount} หวย · prospective ${systemStatus.predictionCount}` : "กำลังใช้ JSON fallback หรือยังตรวจสอบ Neon ไม่สำเร็จ"}>
            <Database />
            <span>{systemStatus?.connected ? "Neon" : "JSON fallback"}</span>
            <i />
          </div>
          <button
            className={`sync${syncNeedsUpdate(freshness, syncNotice) ? " sync-pending" : ""}`}
            disabled={syncing || !selectedId}
            onClick={sync}
          >
            <RefreshCw className={syncing ? "spin" : ""} />
            {syncing
              ? "กำลังซิงก์"
              : syncNeedsUpdate(freshness, syncNotice)
                ? "ซิงก์ข้อมูลใหม่"
                : "ซิงก์ข้อมูล"}
          </button>
        </header>
        {error && (
          <div className="error">
            <strong>ดำเนินการไม่สำเร็จ</strong>
            <span>{error} — cache เดิมยังคงอยู่</span>
          </div>
        )}
        {!analysis && section !== "history" && (
          <Empty onSync={sync} syncing={syncing} />
        )}{" "}
        {analysis && section === "analyze" && (
          <Analyze
            analysis={analysis}
            consensus={consensus}
            integrity={integrity}
            algorithmId={algorithmId === "custom" ? "balanced-v1" : algorithmId}
            setAlgorithm={setAlgorithm}
            dayPattern={dayPattern}
            setDayPattern={setDayPattern}
            onDigit={setDigitDetail}
            onPair={setPairDetail}
            full={fullAnalysis}
            setFull={setFullAnalysis}
            lotteryId={selectedId}
            latestDrawDate={latest}
            candidateCount={candidateCount}
            includeDoubles={doubles}
            onProspectiveChange={loadSystemStatus}
          />
        )}{" "}
        {analysis && section === "statistics" && (
          <Statistics
            analysis={analysis}
            draws={analysisDraws}
            windowSize={windowSize}
            setWindow={setWindow}
            onDigit={setDigitDetail}
            side={positionSide}
            setSide={setPositionSide}
            gapSort={gapSort}
            setGapSort={setGapSort}
          />
        )}{" "}
        {section === "prospective" && (
          <ProspectiveHub catalog={catalog} />
        )}{" "}
        {draws.length > 0 && section === "history" && (
          <HistoryPage
            draws={filtered}
            search={search}
            setSearch={setSearch}
            visible={visible}
            setVisible={setVisible}
          />
        )}{" "}
        {!draws.length && section === "history" && (
          <Empty onSync={sync} syncing={syncing} />
        )}{" "}
        {analysis && section === "backtest" && (
          <BacktestPage
            rows={tests}
            comparisons={comparisons}
            tab={backtestTab}
            setTab={setBacktestTab}
            windowSize={windowSize}
            setWindow={setWindow}
            testDraws={testDraws}
            setTestDraws={setTestDraws}
            formulaDayPattern={formulaDayPattern}
            setFormulaDayPattern={selectFormulaDayPattern}
            formulaSampleSize={formulaDraws.length}
            formulaLatestDrawDate={formulaDraws[0]?.drawDate}
            expanded={expandedRow}
            setExpanded={setExpandedRow}
            historyVersion={computeHistoryVersion(selectedId, formulaDraws)}
            analysisCutoff={formulaDraws[0]?.drawDate ?? null}
          />
        )}{" "}
        {section === "settings" && (
          <SettingsPage
            algorithmId={algorithmId}
            setAlgorithm={setAlgorithm}
            windowSize={windowSize}
            setWindow={setWindow}
            candidateCount={candidateCount}
            setCandidateCount={setCandidateCount}
            doubles={doubles}
            setDoubles={setDoubles}
            digitWeights={digitWeights}
            setDigitWeights={setDigitWeights}
            pairWeights={pairWeights}
            setPairWeights={setPairWeights}
            valid={customValid}
          />
        )}
        <footer>
          การจัดอันดับอ้างอิงสถิติย้อนหลัง
          ไม่ได้เพิ่มความน่าจะเป็นทางคณิตศาสตร์ของผลสุ่มในงวดถัดไป
        </footer>
      </main>
      <nav className="mobile-nav">
        {nav.map((n) => (
          <button
            key={n.id}
            className={section === n.id ? "active" : ""}
            onClick={() => setSection(n.id)}
          >
            <n.icon />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
      {(digitDetail || pairDetail) && (
        <DetailModal
          digit={digitDetail}
          pair={pairDetail}
          analysis={analysis}
          close={() => {
            setDigitDetail(null);
            setPairDetail(null);
          }}
        />
      )}
    </div>
  );
}
function Empty({ onSync, syncing }: { onSync: () => void; syncing: boolean }) {
  return (
    <div className="content empty-state">
      <Database />
      <h2>ยังไม่มีข้อมูลที่รองรับสำหรับหวยนี้</h2>
      <p>
        แหล่งข้อมูลอาจยังไม่เคยซิงก์ หรือมีข้อมูลบางประเภทไม่ครบ
        ระบบจะไม่สร้างค่าที่ขาดหาย
      </p>
      <button className="sync" onClick={onSync}>
        {syncing ? "กำลังซิงก์" : "ซิงก์ข้อมูล"}
      </button>
    </div>
  );
}
function Analyze({
  analysis,
  consensus,
  integrity,
  algorithmId,
  setAlgorithm,
  dayPattern,
  setDayPattern,
  onDigit,
  onPair,
  full,
  setFull,
  lotteryId,
  latestDrawDate,
  candidateCount,
  includeDoubles,
  onProspectiveChange,
}: {
  analysis: NonNullable<ReturnType<typeof analyzeLottery>>;
  consensus: ConsensusResult | null;
  integrity: DataIntegritySummary;
  algorithmId: string;
  setAlgorithm: (id: string) => void;
  dayPattern: DayPattern;
  setDayPattern: (day: DayPattern) => void;
  onDigit: (d: DigitSignal) => void;
  onPair: (p: PairSignal) => void;
  full: boolean;
  setFull: (v: boolean) => void;
  lotteryId: string;
  latestDrawDate: string | undefined;
  candidateCount: number;
  includeDoubles: boolean;
  onProspectiveChange: () => void;
}) {
  const enoughData =
      analysis.sampleSize >=
      (dayPattern === "all" ? analysis.window : MIN_DAY_PATTERN_DRAWS),
    selectedAlgorithmName =
      ALGORITHMS.find((algorithm) => algorithm.id === algorithmId)?.name ??
      algorithmId;
  return (
    <div className="content analyze">
      <div className="analyze-controls">
        <label>
          <span>วิธีวิเคราะห์</span>
          <select
            value={algorithmId}
            onChange={(event) => setAlgorithm(event.target.value)}
          >
            {ALGORITHMS.map((algorithm) => (
              <option key={algorithm.id} value={algorithm.id}>
                {algorithm.name}
              </option>
            ))}
          </select>
        </label>
        <div className="day-pattern-control">
          <span>จับทางตามวัน</span>
          <div className="day-pattern-options" aria-label="เลือกวันออกรางวัล">
            {DAY_PATTERN_OPTIONS.map((option) => (
              <button
                key={String(option.value)}
                className={dayPattern === option.value ? "active" : ""}
                onClick={() => setDayPattern(option.value)}
                title={option.label}
              >
                {option.shortLabel}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="day-pattern-summary">
        {dayPattern === "all" ? (
          <>ใช้ผลย้อนหลังทุกวัน · เปรียบเทียบรูปแบบ ไม่ใช่ความน่าจะเป็น</>
        ) : (
          <>
            กรองเฉพาะงวด{dayPatternLabel(dayPattern)} · พบ {analysis.sampleSize} งวด
            {analysis.sampleSize < MIN_DAY_PATTERN_DRAWS
              ? ` · ต้องมีอย่างน้อย ${MIN_DAY_PATTERN_DRAWS} งวดเพื่อแสดงผล`
              : " · เป็นสถิติเชิงสำรวจ ไม่ใช่หลักฐานว่าวันมีผลต่อเลข"}
          </>
        )}
      </p>
      <section className="hero">
        <div>
          <div className="section-kicker">เลขเด่น 2 ตัวจากสถิติย้อนหลัง</div>
          <h1>
            {enoughData
              ? analysis.standout.map((item) => item.digit).join(" · ")
              : "--"}
          </h1>
          <p>
            {!enoughData
              ? `ข้อมูล${dayPattern === "all" ? "" : dayPatternLabel(dayPattern)}ยังไม่พอ · มี ${analysis.sampleSize} งวด`
              : `${selectedAlgorithmName} · ${dayPattern === "all" ? `${analysis.window} งวดล่าสุด` : `${analysis.sampleSize} งวด${dayPatternLabel(dayPattern)}`}`}
          </p>
          {enoughData && consensus && (
            <div className="hero-consensus-inline">
              <span>Consensus 5 สูตร</span>
              <strong>
                {consensus.digits
                  .slice(0, 5)
                  .map((item) => item.digit)
                  .join(" · ")}
              </strong>
            </div>
          )}
          <small
            className="analysis-integrity"
            title={`${integrity.partialDraws} งวดข้อมูลไม่ครบ · ${integrity.invalidDraws} งวดถูกตัดออกจากการวิเคราะห์`}
          >
            {integrity.status === "complete"
              ? `ข้อมูลครบ ${integrity.usableDraws}/${integrity.requestedDraws} งวด`
              : `ข้อมูลใช้วิเคราะห์ได้ ${integrity.usableDraws}/${integrity.requestedDraws} งวด`}
          </small>
        </div>
        <div className="hero-score">
          <Activity />
          <span>
            ความนิ่งข้ามช่วง{" "}
            <span
              className="info-tip"
              title="คะแนนจัดอันดับจากความถี่ แนวโน้ม ตำแหน่ง และช่วงห่าง ไม่ใช่เปอร์เซ็นต์โอกาสออกรางวัล"
            >
              <Info />
            </span>
          </span>
          <strong>{consensus?.stabilityScore ?? "--"}{consensus?.stabilityScore !== null && consensus?.stabilityScore !== undefined && <small>%</small>}</strong>
          <small>
            {consensus?.stabilityScore === null ? (
              <>
                มี {analysis.sampleSize} งวด
                {dayPattern === "all" ? "" : dayPatternLabel(dayPattern)} · ต้องมีอย่างน้อย 20 งวดเพื่อเทียบช่วง 10/20
              </>
            ) : (
              <>{consensus ? stabilityCopy[consensus.stabilityStatus] : "ข้อมูลยังไม่พอ"} · ไม่ใช่ความน่าจะเป็น</>
            )}
          </small>
        </div>
      </section>
      {enoughData && (
        <>
          <WinSetCard
            digits={analysis.digits}
            history={analysis.history}
            consensus={consensus}
            selectedAlgorithmName={selectedAlgorithmName}
            onDigit={onDigit}
          />
          {consensus && (
            <details className="analyze-disclosure">
              <summary>ดูรายละเอียด Consensus 5 สูตร</summary>
              <ConsensusCard consensus={consensus} />
            </details>
          )}
          <details className="analyze-disclosure prospective-disclosure">
            <summary>บันทึกหลักฐานก่อนงวดออก</summary>
            <ProspectivePanel
              key={`${lotteryId}:${latestDrawDate ?? "none"}:${dayPattern}`}
              lotteryId={lotteryId}
              latestDrawDate={latestDrawDate}
              algorithmId={algorithmId}
              window={analysis.window}
              candidateCount={candidateCount}
              includeDoubles={includeDoubles}
              dayPattern={dayPattern}
              onChange={onProspectiveChange}
            />
          </details>
        </>
      )}
      {enoughData && (
        <details className="analyze-disclosure">
          <summary>สำรวจคู่ที่น่าสนใจบน / ล่าง</summary>
          <div className="section-kicker pair-section-title">
            คู่ที่น่าสนใจจากสถิติ
          </div>
          <div className="pair-grid">
            <PairList title="บน" items={analysis.topPairs} onSelect={onPair} />
            <PairList title="ล่าง" items={analysis.bottomPairs} onSelect={onPair} />
          </div>
          <p className="pair-method-note">
            จัดอันดับจากความแข็งแรงของเลขและความเหมาะสมตามตำแหน่ง
            เป็นการสำรวจรูปแบบย้อนหลัง ไม่ใช่การทำนายผล
          </p>
        </details>
      )}
      {enoughData && <details className="analyze-disclosure">
        <summary>ดูเหตุผลและรายละเอียดคะแนน</summary>
        <section className="why">
        <div className="section-kicker">ทำไมเลขนี้โดดเด่น</div>
        <div className="reason-grid">
          {analysis.standout.flatMap((d) =>
            d.reasons.map((r, i) => (
              <button key={`${d.digit}-${i}`} onClick={() => onDigit(d)}>
                <span>{d.digit}</span>
                <p>{r}</p>
              </button>
            )),
          )}
        </div>
        <button className="text-button" onClick={() => setFull(!full)}>
          {full ? "ซ่อนบทวิเคราะห์" : "ดูบทวิเคราะห์เต็ม →"}
        </button>
        {full && (
          <div className="breakdowns">
            {analysis.standout.map((d) => (
              <article key={d.digit}>
                <div>
                  <strong>เลข {d.digit}</strong>
                  <span>อันดับรวม #{d.rank} / 10</span>
                </div>
                <b>{d.score}</b>
                {Object.entries(d.components).map(([k, v]) => (
                  <label key={k}>
                    <span>{componentLabel(k)}</span>
                    <i>
                      <em style={{ width: `${v}%` }} />
                    </i>
                    <strong>{v}</strong>
                  </label>
                ))}
              </article>
            ))}
          </div>
        )}
        </section>
      </details>}
    </div>
  );
}

function nextDrawDate(latestDrawDate: string | undefined, dayPattern: DayPattern = "all") {
  const date = latestDrawDate ? new Date(`${latestDrawDate}T12:00:00.000Z`) : new Date();
  do date.setUTCDate(date.getUTCDate() + 1);
  while (dayPattern !== "all" && date.getUTCDay() !== dayPattern);
  return date.toISOString().slice(0, 10);
}

function ProspectivePanel({
  lotteryId,
  latestDrawDate,
  algorithmId,
  window,
  candidateCount,
  includeDoubles,
  dayPattern,
  onChange,
}: {
  lotteryId: string;
  latestDrawDate: string | undefined;
  algorithmId: string;
  window: number;
  candidateCount: number;
  includeDoubles: boolean;
  dayPattern: DayPattern;
  onChange: () => void;
}) {
  const [records, setRecords] = useState<ProspectiveRecord[]>([]),
    [drawDate, setDrawDate] = useState(() => nextDrawDate(latestDrawDate, dayPattern)),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState<string | null>(null);
  const load = useCallback(() =>
    fetch(`/api/prospective/${lotteryId}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.ok) setRecords(data.records as ProspectiveRecord[]);
      })
      .catch(() => setRecords([])), [lotteryId]);
  useEffect(() => {
    void load();
  }, [load]);
  async function capture() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/prospective/${lotteryId}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ drawDate, algorithmId, window, candidateCount, includeDoubles, dayPattern }),
        }),
        data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(data.created ? "ล็อก snapshot แล้ว แก้ย้อนหลังไม่ได้" : "มี snapshot ของงวดนี้อยู่แล้ว");
      await load();
      onChange();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ล็อก snapshot ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="prospective-panel">
      <div className="prospective-head">
        <div>
          <div className="section-kicker">PROSPECTIVE EVIDENCE</div>
          <h3>ล็อกสัญญาณก่อนทราบผล</h3>
          <p>ระบบคำนวณใหม่บนเซิร์ฟเวอร์จาก historyVersion ปัจจุบัน และไม่อนุญาตให้แก้ชุดเดิมภายหลัง</p>
        </div>
        <div className="prospective-capture">
          <label><span>วันที่งวดที่จะติดตาม</span><input type="date" min={nextDrawDate(latestDrawDate)} value={drawDate} onChange={(event) => setDrawDate(event.target.value)} /></label>
          <button type="button" disabled={saving || !drawDate} onClick={capture}>{saving ? "กำลังล็อก…" : "ล็อก snapshot"}</button>
        </div>
      </div>
      {message && <p className="prospective-message">{message}</p>}
      <div className="prospective-list">
        {records.length ? records.map((record) => {
          const actualDigits = `${record.outcome?.top3 ?? ""}${record.outcome?.bottom2 ?? ""}`,
            standoutHit = record.outcome ? record.standoutDigits.some((digit) => actualDigits.includes(digit)) : false,
            topHit = record.outcome?.top2 ? record.rankedPairs.top.slice(0, 4).includes(record.outcome.top2) : false,
            bottomHit = record.outcome?.bottom2 ? record.rankedPairs.bottom.slice(0, 4).includes(record.outcome.bottom2) : false;
          return <article key={record.id}>
            <div><time>{formatShortDrawDate(record.drawDate)}</time><span className={record.outcome ? "resolved" : "pending"}>{record.outcome ? "มีผลแล้ว" : "รอผล"}</span></div>
            <strong>{record.standoutDigits.join(" · ")}</strong>
            <small>{record.algorithmVersion} · {record.analysisOptions.sampleSize} งวด · version {record.historyVersion.slice(0, 8)}</small>
            <div className="prospective-pairs"><span>บน {record.rankedPairs.top.slice(0, 4).join(" ")}</span><span>ล่าง {record.rankedPairs.bottom.slice(0, 4).join(" ")}</span></div>
            {record.outcome && <div className="prospective-outcome"><span>ผล บน {record.outcome.top2} · ล่าง {record.outcome.bottom2}</span><small>เลขเด่น {standoutHit ? "เข้า" : "ไม่เข้า"} · Top4 บน {topHit ? "เข้า" : "ไม่เข้า"} · ล่าง {bottomHit ? "เข้า" : "ไม่เข้า"}</small></div>}
          </article>;
        }) : <p className="prospective-empty">ยังไม่มี snapshot ที่ล็อกไว้สำหรับหวยนี้</p>}
      </div>
      <small className="prospective-note">เป็นบันทึกสัญญาณจากสถิติย้อนหลัง ไม่ใช่ความน่าจะเป็นหรือคำรับรองผล</small>
    </section>
  );
}
const stabilityCopy = {
  stable: "ค่อนข้างนิ่ง",
  mixed: "ผสม",
  unstable: "ยังไม่นิ่ง",
  insufficient: "ข้อมูลยังไม่พอ",
} as const;
function ConsensusCard({ consensus }: { consensus: ConsensusResult }) {
  return (
    <section className="consensus-card">
      <div className="consensus-head">
        <div>
          <div className="section-kicker">CONSENSUS SIGNAL</div>
          <h3>เลขที่หลายวิธีเห็นตรงกัน</h3>
        </div>
        <span className={`stability ${consensus.stabilityStatus}`}>
          ความนิ่ง: {stabilityCopy[consensus.stabilityStatus]}
        </span>
      </div>
      <div className="consensus-grid">
        {consensus.digits.slice(0, 5).map((item) => (
          <article key={item.digit}>
            <strong>{item.digit}</strong>
            <div>
              <b>
                เห็นตรงกัน {item.votes}/{consensus.formulaCount} สูตร
              </b>
              <span>
                อันดับเฉลี่ย {item.averageRank} · ติดชุดใน {item.stableWindows}/
                {consensus.eligibleWindows.length || 1} ช่วง
              </span>
            </div>
            <i>
              <em
                style={{
                  width: `${(item.votes / consensus.formulaCount) * 100}%`,
                }}
              />
            </i>
          </article>
        ))}
      </div>
      <p>
        {consensus.eligibleWindows.length >= 2
          ? `ตรวจความนิ่งจากช่วง ${consensus.eligibleWindows.join(" / ")} งวด${
              consensus.stabilityScore === null
                ? ""
                : ` · ความสอดคล้อง ${consensus.stabilityScore}%`
            }`
          : "ต้องมีข้อมูลอย่างน้อย 20 งวดเพื่อเปรียบเทียบความนิ่งข้ามช่วง"}
        {" · "}Consensus คือความเห็นตรงกันของสูตรเดิม ไม่ใช่โอกาสออกรางวัล
      </p>
    </section>
  );
}
function WinSetCard({
  digits,
  history,
  consensus,
  selectedAlgorithmName,
  onDigit,
}: {
  digits: DigitSignal[];
  history: LotteryDraw[];
  consensus: ConsensusResult | null;
  selectedAlgorithmName: string;
  onDigit: (digit: DigitSignal) => void;
}) {
  const [winSize, setWinSize] = useState(6),
    [focusMode, setFocusMode] = useState<
      "core-support" | "tiered" | "distributed" | "diversified"
    >("core-support"),
    consensusDigits =
      consensus?.digits
        .map((item) => digits.find((digit) => digit.digit === item.digit))
        .filter((digit): digit is DigitSignal => Boolean(digit)) ?? digits,
    distributedConsensus = consensus
      ? buildDistributedConsensus(consensus, winSize === 5 ? 1 : 2)
      : null,
    distributedDigits =
      distributedConsensus?.digits
        .map((item) => digits.find((digit) => digit.digit === item.digit))
        .filter((digit): digit is DigitSignal => Boolean(digit)) ?? [],
    diversified = buildDiversifiedWinSix(digits, consensus),
    winDigits =
      focusMode === "diversified" && winSize === 6
        ? diversified.digits
        : focusMode === "distributed" && (winSize === 5 || winSize === 6)
        ? distributedDigits
        : focusMode === "core-support"
        ? digits.slice(0, winSize)
        : consensusDigits.slice(0, winSize),
    winSet = buildWinSet(
      winDigits.map((digit) => digit.digit),
      winSize,
    ),
    coverage = historicalWinCoverage(history, winDigits.map((digit) => digit.digit)),
    focusedWinSet = buildFocusedWinSet(
      digits.map((digit) => digit.digit),
    ),
    tieredWinSet = buildTieredWinSet(
      consensusDigits.map((digit) => digit.digit),
    ),
    distributedWinSet = buildTieredWinSet(
      distributedDigits.map((digit) => digit.digit),
      winSize === 5 ? 5 : 6,
    ),
    consensusReady =
      consensus?.stabilityStatus === "stable" &&
      consensus.digits.slice(0, 2).every((digit) => digit.votes >= 4),
    selectedCoreVotes = digits
      .slice(0, 2)
      .map(
        (digit) =>
          consensus?.digits.find((item) => item.digit === digit.digit)?.votes ?? 0,
      ),
    selectedReady =
      consensus?.stabilityStatus === "stable" &&
      selectedCoreVotes.every((votes) => votes >= 3),
    distributedReady =
      consensusReady &&
      (distributedConsensus?.inserts.every((digit) => digit.bestRank <= 5) ?? false),
    trackingEvidence = {
      stable: consensus?.stabilityStatus === "stable",
      consensusMainVotes: consensus?.digits.slice(0, 2).map((digit) => digit.votes) ?? [],
      selectedCoreVotes,
      distributedInsertBestRanks: distributedConsensus?.inserts.map((digit) => digit.bestRank) ?? [],
      diversifiedMainVotes: diversified.main.map((digit) => consensus?.digits.find((item) => item.digit === digit.digit)?.votes ?? 0),
      diversifiedPositionRanks: diversified.position.map((digit) => digit.positionRank),
      diversifiedMomentum: diversified.contrarian[0]?.momentum ?? null,
    },
    trackingByMode = Object.fromEntries(
      (["tiered", "core-support", "distributed", "diversified"] as WinTrackingMode[]).map((mode) => [mode, evaluateWinTracking(mode, trackingEvidence)]),
    ) as Record<WinTrackingMode, ReturnType<typeof evaluateWinTracking>>,
    activeTracking = trackingByMode[focusMode],
    focusReady = winSize === 6
      ? activeTracking.passed
      : focusMode === "tiered"
        ? consensusReady
        : focusMode === "distributed"
          ? distributedReady
          : selectedReady,
    sameWinSet =
      [...consensusDigits.slice(0, winSize).map((digit) => digit.digit)]
        .sort()
        .join("") ===
      [...(focusMode === "distributed" ? distributedDigits : focusMode === "diversified" ? diversified.digits : digits.slice(0, winSize))]
        .map((digit) => digit.digit)
        .sort()
        .join(""),
    activeTieredWinSet =
      focusMode === "distributed" ? distributedWinSet : tieredWinSet,
    tierGroups = [
      {
        label: "ชุดหลัก",
        pairs: activeTieredWinSet.primaryPairs,
        mode: "tier-primary" as const,
      },
      {
        label: focusMode === "distributed" ? "ชุดกลาง" : "ชุดรอง",
        pairs: activeTieredWinSet.secondaryPairs,
        mode: "tier-secondary" as const,
      },
      {
        label: focusMode === "distributed" ? "ชุดตัวแทรก" : "ชุดกัน",
        pairs: activeTieredWinSet.coverPairs,
        mode: "tier-cover" as const,
      },
    ],
    [copied, setCopied] = useState<
      | "pairs"
      | "with-doubles"
      | "focus"
      | "support"
      | "focus-all"
      | "tier-primary"
      | "tier-secondary"
      | "tier-cover"
      | null
    >(null);
  async function copyPairs(
    mode:
      | "pairs"
      | "with-doubles"
      | "focus"
      | "support"
      | "focus-all"
      | "tier-primary"
      | "tier-secondary"
      | "tier-cover",
    pairs: string[],
  ) {
    try {
      await navigator.clipboard.writeText(pairs.join(" "));
      setCopied(mode);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  }
  return (
    <section className="win-set-card">
      <div className="win-set-head">
        <div>
          <div className="section-kicker">ชุดเลขวินจากสถิติ</div>
          <h3>วิน {winSize} ตัว</h3>
        </div>
        <div className="win-size-control">
          <span>จำนวนเลขวิน</span>
          <div>
            {[3, 4, 5, 6, 7, 8].map((size) => (
              <button
                key={size}
                className={winSize === size ? "active" : ""}
                onClick={() => {
                  setWinSize(size);
                  if (
                    (size !== 5 && size !== 6 && focusMode === "distributed") ||
                    (size !== 6 && focusMode === "diversified")
                  )
                    setFocusMode("tiered");
                  setCopied(null);
                }}
                type="button"
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      </div>
      <small className="win-set-note">
        {focusMode === "core-support"
          ? `ชุดทางเลือกจาก ${selectedAlgorithmName}`
          : focusMode === "diversified"
            ? "หลัก 3 จาก Consensus · ตำแหน่ง 2 · สวน Momentum 1"
          : focusMode === "distributed"
            ? "ชุดกระจายอันดับจาก Consensus"
            : "เรียงจาก Consensus ของ 5 สูตรเดิม"}
        {" · "}ไม่ใช่ความน่าจะเป็น
      </small>
      <div className="win-source-control">
        <span>แหล่งคัดเลขวิน</span>
        <div className="focus-mode-control">
          <button
            className={focusMode === "tiered" ? "active" : ""}
            onClick={() => {
              setFocusMode("tiered");
              setCopied(null);
            }}
            type="button"
          >
            ชุดหลัก · Consensus
            {winSize === 6 && <i className={`mode-tracking-dot ${trackingByMode.tiered.passed ? "passed" : "waiting"}`} title={trackingByMode.tiered.passed ? "ผ่านเกณฑ์ติดตาม" : "ยังไม่ผ่านเกณฑ์ติดตาม"} />}
          </button>
          <button
            className={focusMode === "core-support" ? "active" : ""}
            onClick={() => {
              setFocusMode("core-support");
              setCopied(null);
            }}
            type="button"
          >
            ชุดทางเลือก · {selectedAlgorithmName}
            {winSize === 6 && <i className={`mode-tracking-dot ${trackingByMode["core-support"].passed ? "passed" : "waiting"}`} title={trackingByMode["core-support"].passed ? "ผ่านเกณฑ์ติดตาม" : "ยังไม่ผ่านเกณฑ์ติดตาม"} />}
          </button>
          {(winSize === 5 || winSize === 6) && (
            <button
              className={focusMode === "distributed" ? "active" : ""}
              onClick={() => {
                setFocusMode("distributed");
                setCopied(null);
              }}
              type="button"
            >
              กระจายอันดับ · {winSize === 5 ? "2+2+1" : "2+2+2"}
              {winSize === 6 && <i className={`mode-tracking-dot ${trackingByMode.distributed.passed ? "passed" : "waiting"}`} title={trackingByMode.distributed.passed ? "ผ่านเกณฑ์ติดตาม" : "ยังไม่ผ่านเกณฑ์ติดตาม"} />}
            </button>
          )}
          {winSize === 6 && (
            <button
              className={focusMode === "diversified" ? "active" : ""}
              onClick={() => {
                setFocusMode("diversified");
                setCopied(null);
              }}
              type="button"
            >
              กระจายสัญญาณ · 3+2+1
              <i className={`mode-tracking-dot ${trackingByMode.diversified.passed ? "passed" : "waiting"}`} title={trackingByMode.diversified.passed ? "ผ่านเกณฑ์ติดตาม" : "ยังไม่ผ่านเกณฑ์ติดตาม"} />
            </button>
          )}
        </div>
      </div>
      {winSize === 6 && (
        <div className={`win-tracking-gate ${activeTracking.passed ? "passed" : "waiting"}`}>
          <div>
            <strong>{activeTracking.passed ? "ผ่านเกณฑ์ติดตาม" : "ยังไม่ผ่านเกณฑ์ติดตาม"}</strong>
            <span>เป็นเกณฑ์คัดสัญญาณ ไม่ใช่เปอร์เซ็นต์ความน่าจะเป็น</span>
          </div>
          <ul>
            {activeTracking.checks.map((check) => (
              <li className={check.passed ? "passed" : "waiting"} key={check.label}>
                {check.passed ? <Check /> : <Minus />}{check.label}
              </li>
            ))}
          </ul>
        </div>
      )}
      {sameWinSet && (
        <p className="same-win-set-note">
          สองวิธีเห็นเลขวิน {winSize} ตัวชุดเดียวกันในงวดนี้ แต่ลำดับอาจต่างกัน
        </p>
      )}
      {winSize >= 7 && (
        <p className="large-win-warning">
          วิน {winSize} ตัวเพิ่มการครอบคลุมเป็น {winSet.uniquePairs.length} คู่ไม่ซ้ำ
          ไม่ได้หมายถึงสัญญาณแข็งแรงขึ้น
        </p>
      )}
      <div className="win-digits">
        {winDigits.map((digit) => (
          <button key={digit.digit} onClick={() => onDigit(digit)}>
            {digit.digit}
          </button>
        ))}
      </div>
      <div className="win-coverage" title="สรุปข้อมูล 30 งวดชุดเดียวกับที่ใช้คัดเลข ไม่ใช่การทดสอบย้อนหลังหรือโอกาสงวดหน้า">
        <div>
          <span>ความครอบคลุมของข้อมูลที่ใช้คัด</span>
          <strong>{coverage.rate === null ? "--" : `${Math.round(coverage.rate * 100)}%`}</strong>
          <small>{coverage.hits}/{coverage.total} งวด · สถิติเชิงพรรณนา</small>
        </div>
        {winSize === 6 && coverage.randomBaseline !== null && (
          <p>ใช้ข้อมูลชุดเดียวกับที่คัด · ไม่ใช่ผล backtest หรือโอกาสงวดหน้า</p>
        )}
      </div>
      {winSize === 6 && focusMode === "diversified" && (
        <section className="diversified-win-summary">
          <div><small>หลัก 3 · Consensus</small><strong>{diversified.main.map((digit) => digit.digit).join(" · ")}</strong></div>
          <div><small>ตำแหน่ง 2</small><strong>{diversified.position.map((digit) => digit.digit).join(" · ")}</strong></div>
          <div><small>สวน 1 · Momentum</small><strong>{diversified.contrarian.map((digit) => digit.digit).join(" · ")}</strong></div>
        </section>
      )}
      <details className="win-pair-expander">
        <summary>ดูกางคู่กลับทั้งหมด {winSet.orderedPairs.length} คู่</summary>
        <div className="win-pairs" aria-label={`คู่กลับจากเลขวิน ${winSize} ตัว`}>
          {winSet.orderedPairs.map((pair) => (
            <span key={pair}>{pair}</span>
          ))}
        </div>
      </details>
      <div className="win-doubles">
        <strong>เลขเบิ้ลจากชุดวิน</strong>
        <div>
          {winSet.doubles.map((pair) => (
            <span key={pair}>{pair}</span>
          ))}
        </div>
      </div>
      {focusMode !== "diversified" && (winSize === 6 || (winSize === 5 && focusMode === "distributed")) && (
        <section className={`focused-win${focusReady ? " ready" : " pending"}`}>
          <div className="focused-win-head">
            <div>
              <div className="section-kicker">วิน {winSize} เน้น</div>
              <h4>
                {focusMode !== "core-support" ? (
                  <>
                    {focusMode === "distributed"
                      ? "ชุดกระจายอันดับจาก Consensus"
                      : "ชุดหลักจาก Consensus 5 สูตร"}
                  </>
                ) : (
                  <>
                    แกนหลัก {focusedWinSet.coreDigits.join(" · ")} · ตัวเสริม{" "}
                    {focusedWinSet.supportDigits.join(" · ")}
                  </>
                )}
              </h4>
            </div>
            <span>{focusReady ? "ผ่านเกณฑ์ติดตาม" : "สัญญาณยังไม่ผ่านเกณฑ์"}</span>
          </div>
          {focusReady ? (
            <>
              {focusMode !== "core-support" ? (
                <>
                  <div className="tiered-digits">
                    <span><small>หลัก</small>{activeTieredWinSet.mainDigits.join(" · ")}</span>
                    <span><small>{focusMode === "distributed" ? "กลาง" : "รอง"}</small>{activeTieredWinSet.secondaryDigits.join(" · ")}</span>
                    <span><small>{focusMode === "distributed" ? "ตัวแทรก" : "กัน"}</small>{activeTieredWinSet.coverDigits.join(" · ")}</span>
                  </div>
                  {focusMode === "distributed" && (
                    <p className="distributed-method-note">
                      กลางคัดจากอันดับ 3–6 ที่นิ่งที่สุด · ตัวแทรกคัดจากอันดับ 7–10 ที่บางสูตรเคยจัดไว้สูง
                    </p>
                  )}
                  <div className="focused-pair-groups three-tiers">
                    {tierGroups.map(({ label, pairs, mode }) => (
                      <div key={label}>
                        <strong>{label} · {pairs.length} คู่</strong>
                        <div>
                          {pairs.map((pair) => <b key={pair}>{pair}</b>)}
                        </div>
                        <button
                          onClick={() => copyPairs(mode, pairs)}
                          type="button"
                        >
                          {copied === mode ? <Check /> : <Copy />}
                          {copied === mode ? "คัดลอกแล้ว" : `คัดลอก${label}`}
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="focused-pair-groups">
                  <div>
                    <strong>ชุดเน้น · มีเลขแกนหลัก</strong>
                    <div>
                      {focusedWinSet.focusedPairs.map((pair) => (
                        <b key={pair}>{pair}</b>
                      ))}
                    </div>
                  </div>
                  <div>
                    <strong>ชุดรอง · ตัวเสริมจับกัน</strong>
                    <div>
                      {focusedWinSet.supportPairs.map((pair) => (
                        <b key={pair}>{pair}</b>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="focused-copy-actions">
                {focusMode === "core-support" && <>
                  <button onClick={() => copyPairs("focus", focusedWinSet.focusedPairs)} type="button">
                    {copied === "focus" ? <Check /> : <Copy />}
                    {copied === "focus" ? "คัดลอกแล้ว" : "คัดลอกชุดเน้น 9 คู่"}
                  </button>
                  <button onClick={() => copyPairs("support", focusedWinSet.supportPairs)} type="button">
                    {copied === "support" ? <Check /> : <Copy />}
                    {copied === "support" ? "คัดลอกแล้ว" : "คัดลอกชุดรอง 6 คู่"}
                  </button>
                </>}
                <button
                  onClick={() =>
                    copyPairs("focus-all", [
                      ...winSet.uniquePairs,
                      ...winSet.doubles,
                    ])
                  }
                  type="button"
                >
                  {copied === "focus-all" ? <Check /> : <Copy />}
                  {copied === "focus-all" ? "คัดลอกแล้ว" : "คัดลอกรวม + เบิ้ล"}
                </button>
              </div>
            </>
          ) : (
            <p>
              {focusMode === "tiered"
                ? "ชุดหลักต้องให้เลขสองอันดับแรกเห็นตรงกันอย่างน้อย 4/5 สูตร"
                : focusMode === "distributed"
                  ? "ชุดกระจายต้องมีตัวแทรกที่อย่างน้อยหนึ่งสูตรเคยจัดไว้ใน Top 5"
                  : "ชุดทางเลือกต้องให้เลขแกนสองตัวได้รับเสียงสนับสนุนอย่างน้อย 3/5 สูตร"}
              {" และความนิ่งข้ามช่วงต้องอยู่ในระดับค่อนข้างนิ่ง จึงจะเปิดชุดเน้น"}
            </p>
          )}
        </section>
      )}
      <div className="win-set-footer">
        <p>
          กางครบ {winSet.orderedPairs.length} คู่แบบไม่รวมเลขเบิ้ล · แตะเลขเพื่อดูเหตุผลทางสถิติ
        </p>
        <div className="win-copy-actions">
          <button
            onClick={() => copyPairs("pairs", winSet.uniquePairs)}
            type="button"
          >
            {copied === "pairs" ? <Check /> : <Copy />}
            {copied === "pairs"
              ? "คัดลอกแล้ว"
            : `คัดลอกคู่ไม่ซ้ำ ${winSet.uniquePairs.length} คู่`}
          </button>
          <button
            className="copy-with-doubles"
            onClick={() =>
              copyPairs("with-doubles", winSet.uniquePairsWithDoubles)
            }
            type="button"
          >
            {copied === "with-doubles" ? <Check /> : <Copy />}
            {copied === "with-doubles"
              ? "คัดลอกแล้ว"
              : `รวมเลขเบิ้ล ${winSet.uniquePairsWithDoubles.length} คู่`}
          </button>
        </div>
      </div>
    </section>
  );
}
function PairList({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: PairSignal[];
  onSelect: (p: PairSignal) => void;
}) {
  return (
    <section className="pair-card">
      <div className="section-kicker">{title}</div>
      {items.map((p, i) => (
        <button className="pair-row" key={p.pair} onClick={() => onSelect(p)}>
          <span className="pair-rank">{String(i + 1).padStart(2, "0")}</span>
          <strong>{p.pair}</strong>
          <span>อันดับจากข้อมูล {p.score.toFixed(1)}</span>
        </button>
      ))}
    </section>
  );
}
function prospectiveHitSummary(record: ProspectiveRecord) {
  if (!record.outcome) return null;
  const digits = `${record.outcome.top3 ?? ""}${record.outcome.bottom2 ?? ""}`;
  return {
    standout: record.standoutDigits.some((digit) => digits.includes(digit)),
    top4: Boolean(record.outcome.top2 && record.rankedPairs.top.slice(0, 4).includes(record.outcome.top2)),
    bottom4: Boolean(record.outcome.bottom2 && record.rankedPairs.bottom.slice(0, 4).includes(record.outcome.bottom2)),
  };
}

async function downloadProspective(format: "json" | "csv") {
  const response = await fetch(`/api/prospective?format=${format}`), blob = await response.blob(), url = URL.createObjectURL(blob), anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `roodlab-prospective.${format}`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function ProspectiveHub({ catalog }: { catalog: LotteryDefinition[] }) {
  const [records, setRecords] = useState<ProspectiveRecord[]>([]),
    [loading, setLoading] = useState(true),
    [filter, setFilter] = useState<"all" | "pending" | "resolved">("all");
  useEffect(() => {
    let cancelled = false;
    fetch("/api/prospective")
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled && data.ok) setRecords(data.records as ProspectiveRecord[]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);
  const resolved = records.filter((record) => record.outcome),
    summaries = resolved.map(prospectiveHitSummary).filter((item): item is NonNullable<typeof item> => Boolean(item)),
    count = (key: keyof NonNullable<ReturnType<typeof prospectiveHitSummary>>) => summaries.filter((summary) => summary[key]).length,
    shown = records.filter((record) => filter === "all" || (filter === "resolved") === Boolean(record.outcome)),
    names = new Map(catalog.map((item) => [item.id, item.name]));
  return <div className="content prospective-hub">
    <div className="section-head">
      <div><div className="section-kicker">PROSPECTIVE EVIDENCE</div><h2>หลักฐานที่ล็อกไว้ล่วงหน้า</h2><p>อ่านผลจาก snapshot ก่อนงวดออก แยกจาก outcome และไม่แก้ย้อนหลัง</p></div>
      <div className="prospective-export"><button type="button" onClick={() => void downloadProspective("json")}><Download />JSON</button><button type="button" onClick={() => void downloadProspective("csv")}><Download />CSV</button></div>
    </div>
    <div className="prospective-metrics">
      <article><span>ล็อกทั้งหมด</span><strong>{records.length}</strong><small>รอผล {records.length - resolved.length} · มีผล {resolved.length}</small></article>
      <article><span>เลขเด่นเข้า</span><strong>{resolved.length ? `${count("standout")}/${resolved.length}` : "--"}</strong><small>random reference ≈ 66.35%</small></article>
      <article><span>บน Top4</span><strong>{resolved.length ? `${count("top4")}/${resolved.length}` : "--"}</strong><small>random reference ≈ 4%</small></article>
      <article><span>ล่าง Top4</span><strong>{resolved.length ? `${count("bottom4")}/${resolved.length}` : "--"}</strong><small>random reference ≈ 4%</small></article>
    </div>
    <p className="prospective-baseline-note"><Info /> ตัวเลขเป็นผลเชิงพรรณนาตาม sample ที่ล็อกจริง ยังไม่ใช่หลักฐานว่าสูตรชนะ baseline</p>
    <div className="prospective-toolbar"><div className="segment">{(["all", "pending", "resolved"] as const).map((value) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value === "all" ? "ทั้งหมด" : value === "pending" ? "รอผล" : "มีผลแล้ว"}</button>)}</div><span>{shown.length} รายการ</span></div>
    <div className="prospective-hub-list">
      {loading ? <p>กำลังอ่านหลักฐาน…</p> : shown.length ? shown.map((record) => {
        const hit = prospectiveHitSummary(record);
        return <article key={record.id}>
          <div className="prospective-row-title"><div><strong>{names.get(record.lotteryId) ?? record.lotteryId}</strong><time>{formatShortDrawDate(record.drawDate)}</time></div><span className={record.outcome ? "resolved" : "pending"}>{record.outcome ? "มีผลแล้ว" : "รอผล"}</span></div>
          <div className="prospective-row-signals"><span>เด่น <b>{record.standoutDigits.join(" · ")}</b></span><span>บน <b>{record.rankedPairs.top.slice(0, 4).join(" ")}</b></span><span>ล่าง <b>{record.rankedPairs.bottom.slice(0, 4).join(" ")}</b></span></div>
          <small>{record.algorithmVersion} · {record.analysisOptions.sampleSize} งวด · history {record.historyVersion.slice(0, 8)}</small>
          {record.outcome && <div className="prospective-row-result"><span>ผลบน {record.outcome.top2} · ล่าง {record.outcome.bottom2}</span><span>เด่น {hit?.standout ? "เข้า" : "ไม่เข้า"} · Top4 บน {hit?.top4 ? "เข้า" : "ไม่เข้า"} · ล่าง {hit?.bottom4 ? "เข้า" : "ไม่เข้า"}</span></div>}
        </article>;
      }) : <div className="prospective-empty-state"><ClipboardCheck /><strong>ยังไม่มีหลักฐานในตัวกรองนี้</strong><span>ไปหน้า Analyze แล้วเปิด “บันทึกหลักฐานก่อนงวดออก”</span></div>}
    </div>
  </div>;
}

function Statistics({
  analysis,
  draws,
  windowSize,
  setWindow,
  onDigit,
  side,
  setSide,
  gapSort,
  setGapSort,
}: {
  analysis: ReturnType<typeof analyzeLottery>;
  draws: Snapshot["draws"];
  windowSize: number;
  setWindow: (n: number) => void;
  onDigit: (d: DigitSignal) => void;
  side: Side;
  setSide: (s: Side) => void;
  gapSort: "score" | "latest" | "gap";
  setGapSort: (s: "score" | "latest" | "gap") => void;
}) {
  const matrix = positionMatrix(draws.slice(0, windowSize), side),
    max = Math.max(
      1,
      ...matrix.flatMap(
        (r) =>
          Object.values(r).filter((x) => typeof x === "number") as number[],
      ),
    ),
    sorted = [...analysis.digits].sort((a, b) =>
      gapSort === "latest"
        ? (b.gap ?? -1) - (a.gap ?? -1)
        : gapSort === "gap"
          ? (b.averageGap ?? -1) - (a.averageGap ?? -1)
          : b.score - a.score,
    );
  return (
    <div className="content">
      <div className="section-head">
        <div>
          <div className="section-kicker">DIGIT STRENGTH</div>
          <h2>ภาพรวมเลข 0–9</h2>
        </div>
        <Segment
          values={[10, 20, 30, 50, 100]}
          value={windowSize}
          onChange={setWindow}
        />
      </div>
      <div className="heatmap">
        {[...analysis.digits]
          .sort((a, b) => a.digit.localeCompare(b.digit))
          .map((d) => (
            <button
              key={d.digit}
              style={{ "--score": `${d.score}%` } as React.CSSProperties}
              onClick={() => onDigit(d)}
            >
              <strong>{d.digit}</strong>
              <span>{d.score.toFixed(0)}</span>
            </button>
          ))}
      </div>
      <section className="chart-card">
        <h3>Momentum · 10 งวดล่าสุด vs 10 งวดก่อนหน้า</h3>
        <div className="momentum-table">
          <b>เลข</b>
          <b>ก่อนหน้า</b>
          <b>ล่าสุด</b>
          <b>เปลี่ยน</b>
          {[...analysis.digits]
            .sort((a, b) => a.digit.localeCompare(b.digit))
            .map((d) => (
              <div className="momentum-row" key={d.digit}>
                <strong>{d.digit}</strong>
                <span>{d.previous10}</span>
                <span>{d.recent10}</span>
                <em
                  className={
                    d.momentum > 0 ? "rise" : d.momentum < 0 ? "cool" : "stable"
                  }
                >
                  {d.momentum > 0 ? "+" : ""}
                  {d.momentum} · {d.trend}
                </em>
              </div>
            ))}
        </div>
      </section>
      <section className="chart-card">
        <div className="card-title">
          <h3>ความแข็งแรงตามตำแหน่ง</h3>
          <SegmentText
            values={[
              { id: "top", label: "บน" },
              { id: "bottom", label: "ล่าง" },
            ]}
            value={side}
            onChange={(x) => setSide(x as Side)}
          />
        </div>
        <div className="position-grid">
          <b>เลข</b>
          {side === "top" && <b>ร้อย</b>}
          <b>สิบ</b>
          <b>หน่วย</b>
          {matrix.map((r) => (
            <div className={`position-row ${side}`} key={r.digit}>
              <strong>{r.digit}</strong>
              {side === "top" && <Heat value={r.hundreds} max={max} />}
              <Heat value={r.tens} max={max} />
              <Heat value={r.units} max={max} />
            </div>
          ))}
        </div>
      </section>
      <section className="chart-card">
        <div className="card-title">
          <h3>ช่วงห่างของเลข</h3>
          <SegmentText
            values={[
              { id: "score", label: "คะแนน" },
              { id: "latest", label: "ล่าสุด" },
              { id: "gap", label: "ช่วงห่าง" },
            ]}
            value={gapSort}
            onChange={(x) => setGapSort(x as typeof gapSort)}
          />
        </div>
        <div className="gap-table">
          <b>เลข</b>
          <b>ล่าสุด</b>
          <b>เฉลี่ย</b>
          <b>สูงสุด</b>
          {sorted.map((d) => (
            <div className="gap-row" key={d.digit}>
              <strong>{d.digit}</strong>
              <span>{d.gap ?? "--"} งวด</span>
              <span>{d.averageGap ?? "--"}</span>
              <span>{d.longestGap ?? "--"}</span>
            </div>
          ))}
        </div>
        <small>ช่วงห่างเป็นข้อมูลย้อนหลัง ไม่ได้หมายความว่าเลขกำลังจะออก</small>
      </section>
    </div>
  );
}
function Heat({ value, max }: { value: number; max: number }) {
  return (
    <span
      className="position-cell"
      style={{
        backgroundColor: `rgba(50,107,91,${0.08 + (0.72 * value) / max})`,
      }}
    >
      {value}
    </span>
  );
}
function HistoryPage({
  draws,
  search,
  setSearch,
  visible,
  setVisible,
}: {
  draws: Snapshot["draws"];
  search: string;
  setSearch: (s: string) => void;
  visible: number;
  setVisible: (n: number) => void;
}) {
  return (
    <div className="content">
      <div className="section-head">
        <div>
          <div className="section-kicker">HISTORICAL DRAWS</div>
          <h2>ผลย้อนหลัง</h2>
        </div>
        <label className="search">
          <Search />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาวันที่หรือเลข"
          />
        </label>
      </div>
      <div className="history-list">
        {draws.slice(0, visible).map((d) => (
          <article key={d.id}>
            <time>
              {new Intl.DateTimeFormat("th-TH", {
                day: "numeric",
                month: "short",
                year: "numeric",
              }).format(new Date(d.drawDate))}
            </time>
            <div>
              <span>
                3 ตัวบน<strong>{d.top3 ?? "--"}</strong>
              </span>
              <span>
                2 ตัวบน<strong>{d.top2 ?? "--"}</strong>
              </span>
              <span>
                2 ตัวล่าง<strong>{d.bottom2 ?? "--"}</strong>
              </span>
            </div>
            {d.source && (
              <small className="history-source" title={`Source: ${d.source}`}>
                {d.source === "current-result"
                  ? "ผลล่าสุดจากต้นทาง"
                  : "ประวัติจากต้นทาง"}
              </small>
            )}
          </article>
        ))}
      </div>
      {visible < draws.length && (
        <button className="load" onClick={() => setVisible(visible + 20)}>
          แสดงเพิ่ม
        </button>
      )}
    </div>
  );
}
function BacktestPage({
  rows,
  comparisons,
  tab,
  setTab,
  windowSize,
  setWindow,
  testDraws,
  setTestDraws,
  formulaDayPattern,
  setFormulaDayPattern,
  formulaSampleSize,
  formulaLatestDrawDate,
  expanded,
  setExpanded,
  historyVersion,
  analysisCutoff,
}: {
  rows: ReturnType<typeof backtest>;
  comparisons: ReturnType<typeof compareAlgorithms>;
  tab: "results" | "lab";
  setTab: (t: "results" | "lab") => void;
  windowSize: number;
  setWindow: (n: number) => void;
  testDraws: number;
  setTestDraws: (n: number) => void;
  formulaDayPattern: DayPattern;
  setFormulaDayPattern: (day: DayPattern) => void;
  formulaSampleSize: number;
  formulaLatestDrawDate: string | undefined;
  expanded: string | null;
  setExpanded: (s: string | null) => void;
  historyVersion: string;
  analysisCutoff: string | null;
}) {
  const metrics = [
    { label: "เลขเด่นเข้า", m: metric(rows, "standoutHit") },
    { label: "บน Top 4", m: metric(rows, "topHit") },
    { label: "ล่าง Top 4", m: metric(rows, "bottomHit") },
    { label: "บน #1 ตรง", m: metric(rows, "top1Hit") },
  ];
  return (
    <div className="content">
      <div className="lab-tabs">
        <button
          className={tab === "results" ? "active" : ""}
          onClick={() => setTab("results")}
        >
          ผลทดสอบ
        </button>
        <button
          className={tab === "lab" ? "active" : ""}
          onClick={() => setTab("lab")}
        >
          เปรียบเทียบสูตร
        </button>
      </div>
      <p className="research-tool-note">
        สำหรับตรวจสอบและเปรียบเทียบวิธีวิเคราะห์ย้อนหลัง ไม่ใช่หน้าคำแนะนำหลัก
      </p>
      <div className="section-head">
        <div>
          <div className="section-kicker">
            {tab === "lab" ? "FORMULA LAB" : "WALK-FORWARD"}
          </div>
          <h2>{tab === "lab" ? "เปรียบเทียบสูตร" : "ทดสอบย้อนหลัง"}</h2>
          <p>
            {tab === "lab"
              ? "ดูว่าวิธีวิเคราะห์แบบไหนทำผลงานย้อนหลังได้สม่ำเสมอกว่า"
              : "ทุกงวดใช้เฉพาะข้อมูลก่อนวันออกรางวัล"}
          </p>
        </div>
        <div className="control-stack">
          <label>
            <span>ช่วงข้อมูลที่ใช้วิเคราะห์</span>
            <Segment
              values={[10, 20, 30, 50]}
              value={windowSize}
              onChange={setWindow}
            />
          </label>
          <label>
            <span>จำนวนงวดที่ทดสอบย้อนหลัง</span>
            <Segment
              values={[30, 50, 100]}
              value={testDraws}
              onChange={setTestDraws}
            />
          </label>
        </div>
      </div>
      {tab === "lab" && (
        <div className="formula-day-filter">
          <div>
            <strong>เปรียบเทียบตามวันออกรางวัล</strong>
            <small>
              {formulaDayPattern === "all"
                ? `ใช้ทุกวัน · มีข้อมูล ${formulaSampleSize} งวด · งวดล่าสุด ${formatShortDrawDate(formulaLatestDrawDate)}`
                : `เฉพาะ${dayPatternLabel(formulaDayPattern)} · มีข้อมูล ${formulaSampleSize} งวด · งวดล่าสุด ${formatShortDrawDate(formulaLatestDrawDate)}`}
            </small>
          </div>
          <div className="day-pattern-options" aria-label="เลือกวันสำหรับเปรียบเทียบสูตร">
            {DAY_PATTERN_OPTIONS.map((option) => (
              <button
                key={String(option.value)}
                className={formulaDayPattern === option.value ? "active" : ""}
                onClick={() => setFormulaDayPattern(option.value)}
                title={option.label}
              >
                {option.shortLabel}
              </button>
            ))}
          </div>
        </div>
      )}
      {tab === "results" ? (
        <>
          <div className="metrics">
            {metrics.map((x) => (
              <article className="metric" key={x.label}>
                <span>{x.label}</span>
                <strong>{pct(x.m.rate)}</strong>
                <small>
                  {x.m.hits} / {x.m.total} งวด
                </small>
                <small>
                  95% CI {pct(x.m.interval.low)}–{pct(x.m.interval.high)}
                </small>
              </article>
            ))}
          </div>
          {rows.length < 50 && (
            <p className="sample-note">ตัวอย่างยังน้อย ผลลัพธ์อาจแกว่งได้มาก</p>
          )}
          <div className="backtest-list">
            {rows.map((r) => (
              <button
                className="backtest-row"
                key={r.draw.id}
                onClick={() =>
                  setExpanded(expanded === r.draw.id ? null : r.draw.id)
                }
              >
                <div>
                  <time>{r.draw.drawDate}</time>
                  <small>
                    ฝึก {r.trainingSize} งวด · สิ้นสุด {r.trainingEnd}
                  </small>
                </div>
                <span className={r.topHit ? "hit" : "miss"}>
                  บน {r.draw.top2} {r.topHit ? "เข้า" : "ไม่เข้า"}
                </span>
                <span className={r.bottomHit ? "hit" : "miss"}>
                  ล่าง {r.draw.bottom2} {r.bottomHit ? "เข้า" : "ไม่เข้า"}
                </span>
                {expanded === r.draw.id && (
                  <div className="row-detail">
                    <span>
                      เลขรูด<strong>{r.standout.join(" · ")}</strong>
                    </span>
                    <span>
                      คู่ที่จัดอันดับบน<strong>{r.top.join(" ")}</strong>
                    </span>
                    <span>
                      ผลจริง<strong>{r.draw.top2 ?? "--"}</strong>
                    </span>
                    <span>
                      คู่ที่จัดอันดับล่าง<strong>{r.bottom.join(" ")}</strong>
                    </span>
                    <span>
                      ผลจริง<strong>{r.draw.bottom2 ?? "--"}</strong>
                    </span>
                    <span>
                      Algorithm
                      <strong>
                        {ALGORITHMS.find((a) => a.id === r.algorithmId)?.name}
                      </strong>
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </>
      ) : (
        <FormulaTable
          comparisons={comparisons}
          historyVersion={historyVersion}
          analysisCutoff={analysisCutoff}
          dayPattern={formulaDayPattern}
        />
      )}
    </div>
  );
}
function FormulaTable({
  comparisons,
  historyVersion,
  analysisCutoff,
  dayPattern,
}: {
  comparisons: ReturnType<typeof compareAlgorithms>;
  historyVersion: string;
  analysisCutoff: string | null;
  dayPattern: DayPattern;
}) {
  return (
    <>
      <small
        className="formula-integrity"
        title={`History version: ${historyVersion}`}
      >
        วิเคราะห์จากข้อมูลถึง {analysisCutoff ?? "--"} · version{" "}
        {historyVersion.slice(0, 8)}
      </small>
      {comparisons.every((comparison) => comparison.sampleSize === 0) && (
        <p className="sample-note">
          ยังเปรียบเทียบไม่ได้: จำนวนงวดของวันที่เลือกต้องมากกว่าช่วงข้อมูลที่ใช้วิเคราะห์
          ลองเลือกช่วง 10 งวด หรือเลือกทุกวัน
        </p>
      )}
      <div className="formula-table">
        <b>สูตร</b>
        <b>รูดเข้า</b>
        <b>บน Top4</b>
        <b>ล่าง Top4</b>
        <b>Top1</b>
        {comparisons.map((c) => (
          <div className="formula-row" key={c.algorithmId}>
            <strong>
              {c.name}
              <small>n={c.sampleSize}</small>
            </strong>
            {[c.standout, c.top, c.bottom, c.top1].map((m, i) => (
              <span key={i}>
                {m.total ? pct(m.rate) : "--"}
                <small>
                  {m.hits} / {m.total}
                </small>
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="baseline">
        <Info />
        <span>
          <strong>Random reference:</strong> Top 4 ≈{" "}
          {pct(referenceBaselines.top4)}, Top 1 ≈ {pct(referenceBaselines.top1)}{" "}
          ภายใต้ 100 คู่ที่เป็นไปได้และรวมเลขเบิ้ล เป็นค่าคณิตศาสตร์อ้างอิง
          ไม่ใช่ผลสังเกต
        </span>
      </div>
      {dayPattern === "all" ? (
        <PairDiagnosticsPanel />
      ) : (
        <p className="sample-note">
          Pair diagnostics ชุดเดิมเป็นการตรวจทุกวัน จึงซ่อนไว้ขณะกรองตามวันเพื่อไม่ให้ปนกับผลตารางนี้
        </p>
      )}
    </>
  );
}
function SettingsPage({
  algorithmId,
  setAlgorithm,
  windowSize,
  setWindow,
  candidateCount,
  setCandidateCount,
  doubles,
  setDoubles,
  digitWeights,
  setDigitWeights,
  pairWeights,
  setPairWeights,
  valid,
}: {
  algorithmId: string;
  setAlgorithm: (s: string) => void;
  windowSize: number;
  setWindow: (n: number) => void;
  candidateCount: number;
  setCandidateCount: (n: number) => void;
  doubles: boolean;
  setDoubles: (v: boolean) => void;
  digitWeights: DigitWeights;
  setDigitWeights: (v: DigitWeights) => void;
  pairWeights: PairWeights;
  setPairWeights: (v: PairWeights) => void;
  valid: boolean;
}) {
  return (
    <div className="content settings">
      <div className="section-kicker">PREFERENCES</div>
      <h2>ตั้งค่าการวิเคราะห์</h2>
      <Setting
        label="ช่วงข้อมูล"
        description="จำนวนงวดที่ใช้สรุปรูปแบบย้อนหลัง"
      >
        <Segment
          values={[10, 20, 30, 50, 100]}
          value={windowSize}
          onChange={setWindow}
        />
      </Setting>
      <Setting label="จำนวนคู่ที่แสดง" description="แยกคู่บนและล่าง">
        <Segment
          values={[3, 4, 5]}
          value={candidateCount}
          onChange={setCandidateCount}
        />
      </Setting>
      <Setting label="รวมเลขเบิ้ล" description="รวม 00, 11, 22 ถึง 99">
        <button
          className={`toggle ${doubles ? "on" : ""}`}
          onClick={() => setDoubles(!doubles)}
        >
          <i />
        </button>
      </Setting>
      <details className="advanced-research">
        <summary>Advanced / Research</summary>
        <div className="setting algorithm-setting">
          <div>
            <strong>สูตรวิเคราะห์</strong>
            <small>
              {algorithmId === "custom"
                ? "ค่าน้ำหนักที่กำหนดเอง"
                : ALGORITHMS.find((a) => a.id === algorithmId)?.description}
            </small>
          </div>
          <select
            value={algorithmId}
            onChange={(e) => setAlgorithm(e.target.value)}
          >
            {ALGORITHMS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
            <option value="custom">Custom</option>
          </select>
        </div>
        <section className="weights-editor">
          <div className="card-title">
            <h3>ตั้งค่าน้ำหนักขั้นสูง</h3>
            <button
              onClick={() => {
                setDigitWeights(defaultDigit);
                setPairWeights(defaultPair);
                setAlgorithm("balanced-v1");
              }}
            >
              คืนค่า Balanced v1
            </button>
          </div>
          <WeightGroup
            title="Digit Score"
            weights={digitWeights}
            setWeights={(x) => {
              setDigitWeights(x as DigitWeights);
              setAlgorithm("custom");
            }}
          />
          <WeightGroup
            title="Pair Score"
            weights={pairWeights}
            setWeights={(x) => {
              setPairWeights(x as PairWeights);
              setAlgorithm("custom");
            }}
          />
          <p className={valid ? "valid" : "invalid"}>
            {valid
              ? "น้ำหนักแต่ละกลุ่มรวม 100%"
              : "น้ำหนักแต่ละกลุ่มต้องรวม 100%"}
          </p>
        </section>
      </details>
    </div>
  );
}
function WeightGroup({
  title,
  weights,
  setWeights,
}: {
  title: string;
  weights: Record<string, number>;
  setWeights: (v: Record<string, number>) => void;
}) {
  return (
    <div className="weight-group">
      <strong>{title}</strong>
      {Object.entries(weights).map(([key, value]) => (
        <label key={key}>
          <span>{componentLabel(key)}</span>
          <input
            type="number"
            min="0"
            max="100"
            value={Math.round(value * 100)}
            onChange={(e) =>
              setWeights({ ...weights, [key]: Number(e.target.value) / 100 })
            }
          />
          <em>%</em>
        </label>
      ))}
    </div>
  );
}
function DetailModal({
  digit,
  pair,
  analysis,
  close,
}: {
  digit: DigitSignal | null;
  pair: PairSignal | null;
  analysis: ReturnType<typeof analyzeLottery> | null;
  close: () => void;
}) {
  const strongPairs =
    digit && analysis
      ? [...analysis.topPairs, ...analysis.bottomPairs]
          .filter((p) => p.pair.includes(digit.digit))
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
      : [];
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={close}>
          ×
        </button>
        {digit && (
          <>
            <div className="section-kicker">DIGIT DETAIL</div>
            <h2>เลข {digit.digit}</h2>
            <div className="detail-score">
              <strong>{digit.score}</strong>
              <span>อันดับเลข #{digit.rank}/10 จากข้อมูลย้อนหลัง</span>
            </div>
            <div className="detail-grid">
              <span>
                30 งวด<strong>{digit.counts[30]} hits</strong>
              </span>
              <span>
                10 งวดล่าสุด<strong>{digit.recent10} hits</strong>
              </span>
              <span>
                10 งวดก่อนหน้า<strong>{digit.previous10} hits</strong>
              </span>
              <span>
                Momentum
                <strong>
                  <TrendIcon trend={digit.trend} />
                  {digit.trend}
                </strong>
              </span>
              <span>
                Last seen<strong>{digit.gap ?? "--"} งวด</strong>
              </span>
              <span>
                Average gap<strong>{digit.averageGap ?? "--"}</strong>
              </span>
              <span>
                Best position<strong>{digit.strongestPosition}</strong>
              </span>
            </div>
            <h3>คู่ที่แข็งแรงที่สุด</h3>
            <div className="strong-pairs">
              {strongPairs.map((p) => (
                <span key={p.pair}>
                  <strong>{p.pair}</strong> อันดับจากข้อมูล {p.score}
                </span>
              ))}
            </div>
          </>
        )}
        {pair && (
          <>
            <div className="section-kicker">PAIR BREAKDOWN</div>
            <h2>เลข {pair.pair}</h2>
            <div className="detail-score">
              <strong>{pair.score}</strong>
              <span>คะแนนจัดอันดับย้อนหลัง · ไม่ใช่ความน่าจะเป็น</span>
            </div>
            {Object.entries(pair.components).map(([k, v]) => (
              <div className="component" key={k}>
                <span>{componentLabel(k)}</span>
                <i>
                  <b style={{ width: `${v}%` }} />
                </i>
                <strong>{v}</strong>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
function TrendIcon({ trend }: { trend: string }) {
  return trend === "กำลังขึ้น" ? (
    <TrendingUp />
  ) : trend === "กำลังลด" ? (
    <TrendingDown />
  ) : (
    <Minus />
  );
}
function Segment({
  values,
  value,
  onChange,
}: {
  values: number[];
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="segment">
      {values.map((v) => (
        <button
          key={v}
          className={v === value ? "active" : ""}
          onClick={() => onChange(v)}
        >
          {v}
        </button>
      ))}
    </div>
  );
}
function SegmentText({
  values,
  value,
  onChange,
}: {
  values: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="segment">
      {values.map((v) => (
        <button
          key={v.id}
          className={v.id === value ? "active" : ""}
          onClick={() => onChange(v.id)}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
function Setting({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="setting">
      <div>
        <strong>{label}</strong>
        <small>{description}</small>
      </div>
      {children}
    </div>
  );
}
function componentLabel(k: string) {
  return (
    (
      {
        frequency: "ความถี่",
        recentFrequency: "ความถี่ล่าสุด",
        momentum: "Momentum",
        positionStrength: "ตำแหน่ง",
        gapPattern: "Gap",
        digitA: "Digit A",
        digitB: "Digit B",
        pairFrequency: "ความถี่คู่",
        recentPairTrend: "แนวโน้มคู่",
        positionMatch: "ตำแหน่งคู่",
      } as Record<string, string>
    )[k] ?? k
  );
}
