// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { BarChart3, History, RadioTower, Settings, Sparkles, TestTube2 } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileNavigation } from "@/components/app-shell/navigation";
import type { PairSignal } from "@/lib/analysis/types";
import { AnalysisDisclosure } from "./analysis-disclosure";
import { AnalyzeControls } from "./analyze-controls";
import { AnalyzePageLayout } from "./analyze-page-layout";
import { GlobalWeekdayWinCard } from "./global-weekday-win-card";
import { PairSection } from "./pair-section";
import { StandoutHero } from "./standout-hero";
import { WindowSelector } from "./window-selector";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Analyze presentation", () => {
  it("places Global Daily before the per-lottery selector and details", () => {
    const { container } = render(<AnalyzePageLayout analysisDate="2026-09-05" globalDaily={<section data-testid="global-daily">Global overview</section>} perLotteryHeader={<button type="button">เลือกหวย</button>}><section>รายละเอียดรายหวย</section></AnalyzePageLayout>);
    const globalDaily = screen.getByTestId("global-daily"),
      lotteryPicker = screen.getByRole("button", { name: "เลือกหวย" });
    expect(globalDaily.compareDocumentPosition(lotteryPicker) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(container).getByRole("heading", { name: "วิเคราะห์รายหวย" })).toBeTruthy();
  });

  it("supports the Global Daily-only product view without mounting per-lottery UI", () => {
    render(<AnalyzePageLayout analysisDate="2026-09-05" globalDaily={<section>Global overview</section>} perLotteryHeader={<button type="button">เลือกหวย</button>} showPerLottery={false}><section>รายละเอียดรายหวย</section></AnalyzePageLayout>);
    expect(screen.getByText("Global overview")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "เลือกหวย" })).toBeNull();
    expect(screen.queryByText("วิเคราะห์รายหวย")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "ส่วนต่าง ๆ ในหน้าวิเคราะห์" })).toBeNull();
  });

  it("renders standout digits as the primary heading value", () => {
    render(<StandoutHero enoughData digits={["9", "0"]} context="วิเคราะห์จาก 30 งวดล่าสุด" insufficientCopy="ข้อมูลไม่พอ" consensusDigits={["9", "0", "5"]} integrity={{ requestedDraws: 30, usableDraws: 30, partialDraws: 0, invalidDraws: 0, latestCompleteDrawDate: "2026-08-30", status: "complete" }} stabilityScore={85} stabilityDetail="ค่อนข้างนิ่ง · ไม่ใช่ความน่าจะเป็น" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("9 · 0");
    expect(screen.getByText("วิเคราะห์จาก 30 งวดล่าสุด")).toBeTruthy();
  });

  it("preserves leading zeroes in pair rendering", () => {
    const pair = (value: string): PairSignal => ({ pair: value, score: 42, components: { digitA: 1, digitB: 1, pairFrequency: 1, recentPairTrend: 1, positionMatch: 1 }, reasons: [] });
    render(<PairSection top={[pair("05")]} bottom={[pair("09")]} onSelect={() => undefined} />);
    expect(screen.getByText("05")).toBeTruthy();
    expect(screen.getByText("09")).toBeTruthy();
  });

  it("changes the analysis window through an explicit button", () => {
    const onChange = vi.fn();
    render(<WindowSelector value={30} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "50งวด" }));
    expect(onChange).toHaveBeenCalledWith(50);
  });

  it("keeps advanced filters collapsed while summarizing the all-days default", () => {
    render(<AnalyzeControls windowSize={30} onWindowChange={() => undefined} dayPattern="all" onDayPatternChange={() => undefined} sampleSize={30} minimumDayDraws={10} />);
    expect(screen.getByText("30 งวดล่าสุด · ทุกวัน")).toBeTruthy();
    expect(screen.getByText("ตัวกรองเพิ่มเติม").closest("details")?.open).toBe(false);
    expect(screen.getByText("ใช้ข้อมูลทุกวันเพื่อให้มีจำนวนงวดมากและสถิตินิ่งกว่า")).toBeTruthy();
  });

  it("labels a small weekday sample as insufficient for stability", () => {
    render(<AnalyzeControls windowSize={100} onWindowChange={() => undefined} dayPattern={4} onDayPatternChange={() => undefined} sampleSize={14} minimumDayDraws={10} />);
    expect(screen.getByText(/พบ 14 งวด · ข้อมูลยังไม่พอวัดความนิ่ง/)).toBeTruthy();
  });

  it("renders one shared six-digit weekday set from the aggregate API", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        weekday: 2,
        weekdayLabel: "วันอังคาร",
        digits: ["7", "1", "9", "3", "5", "8"].map((digit) => ({ digit, score: 0.2, topRate: 0.2, bottomRate: 0.2 })),
        rankedDigits: ["7", "1", "9", "3", "5", "8", "2", "4", "0", "6"].map((digit) => ({ digit, score: 0.2, topRate: 0.2, bottomRate: 0.2 })),
        lotteryCount: 42,
        topLotteryCount: 42,
        bottomLotteryCount: 40,
        topDrawCount: 480,
        bottomDrawCount: 455,
        lookbackPerLottery: 12,
        cutoffDate: "2026-09-01",
        sufficient: true,
        sourcePoolCount: 43,
        scoreDistribution: {
          rankedScores: ["7", "1", "9", "3", "5", "8", "2", "4", "0", "6"].map((digit, index) => ({ rank: index + 1, digit, score: 0.2 - index * 0.001 })),
          rank6To7Gap: 0.0042,
          top6Spread: 0.01,
          allDigitSpread: 0.02,
          normalizedEntropy: 0.99,
          concentration: 0.01,
        },
        frequentPairs: ["05", "17", "24", "19", "09", "33", "28", "18", "56", "49", "12", "44", "68", "03", "27", "57", "11", "39", "06", "88", ...Array.from({ length: 8 }, (_, index) => String(index + 60)), ...Array.from({ length: 19 }, (_, index) => String(index + 69)), ...Array.from({ length: 3 }, (_, index) => String(index + 89))].map((pair, index) => ({ pair, score: 0.1 - index * 0.001, topRate: 0.1, bottomRate: 0.1 })),
        frequentDoubles: ["33", "44", "11"].map((pair, index) => ({ pair, score: 0.1 - index * 0.01, topRate: 0.1, bottomRate: 0.1 })),
        pairDerivedDigits: ["1", "2", "9", "0", "8", "7"].map((digit, index) => ({ digit, score: 1 - index * 0.1 })),
      }),
    }));
    render(<GlobalWeekdayWinCard />);
    expect(await screen.findByRole("heading", { name: "Global Daily" })).toBeTruthy();
    const primaryWin = screen.getByLabelText("วินรวมทุกหวย 7 1 9 3 5 8");
    expect(primaryWin.children).toHaveLength(6);
    const pairButton = screen.getByRole("button", { name: "ดูชุดทั้งหมด 21 คู่" });

    // Primary Win-6-derived play set - pure combinatorics from Production Win 6 (digits: 7 1 9 3 5 8),
    // completely independent of frequentPairs/evidence data and of the hero's 5/6/7 selector.
    expect(screen.getByText("ชุดวิน 6 — 15 คู่ + 6 เบิ้ล")).toBeTruthy();
    expect(screen.getByText("แตกคู่จากวิน 6 ตัวหลักของวันนี้")).toBeTruthy();
    expect(screen.getByText("ชุดหลัก")).toBeTruthy();
    const win6Pairs = screen.getByLabelText(/ชุดวิน 6/);
    const win6NonDoubles = Array.from(win6Pairs.querySelectorAll(".global-win-frequent-pair-list:not(.doubles) b"), (item) => item.textContent);
    expect(win6NonDoubles).toEqual(["71", "79", "73", "75", "78", "19", "13", "15", "18", "93", "95", "98", "35", "38", "58"]);
    const win6Doubles = Array.from(win6Pairs.querySelectorAll(".global-win-frequent-pair-list.doubles b"), (item) => item.textContent);
    expect(win6Doubles).toEqual(["77", "11", "99", "33", "55", "88"]);
    expect(screen.getByText("คู่กลับ 15 คู่")).toBeTruthy();
    expect(screen.getByText("เลขเบิ้ล 6 ตัว")).toBeTruthy();
    const copyWin6Canonical = screen.getByRole("button", { name: "คัดลอก 15 คู่ + 6 เบิ้ล" });
    fireEvent.click(copyWin6Canonical);
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("71 79 73 75 78 19 13 15 18 93 95 98 35 38 58 77 11 99 33 55 88"));
    const copyWin6Expanded = screen.getByRole("button", { name: "คัดลอกชุดเล่น 36 เลข" });
    fireEvent.click(copyWin6Expanded);
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith([
      "71", "79", "73", "75", "78",
      "17", "19", "13", "15", "18",
      "97", "91", "93", "95", "98",
      "37", "31", "39", "35", "38",
      "57", "51", "59", "53", "58",
      "87", "81", "89", "83", "85",
      "77", "11", "99", "33", "55", "88",
    ].join(" ")));

    // Demoted historical-evidence pairs - explicitly not the primary set, only reachable via a details overflow.
    expect(screen.getByText("คู่เด่นจากสถิติย้อนหลัง")).toBeTruthy();
    expect(screen.getByText("ข้อมูลประกอบการตัดสินใจ ไม่ใช่ชุดหลัก")).toBeTruthy();
    const evidencePairs = screen.getByLabelText(/คู่เด่นจากสถิติย้อนหลัง/);
    const shownEvidencePairs = Array.from(evidencePairs.querySelectorAll(".global-win-frequent-pair-list:not(.doubles) b"), (item) => item.textContent);
    expect(shownEvidencePairs).toHaveLength(21); // all 21 evidence pairs shown directly, nothing hidden
    expect(evidencePairs.querySelectorAll(".global-win-frequent-pair-list.focused b")).toHaveLength(10);
    expect(screen.getByText("เน้นพิเศษ 10 คู่")).toBeTruthy();
    expect(screen.getByText("คู่หลักที่เหลือ 11 คู่")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "คัดลอก 21 คู่ + เบิ้ล" })).toBeNull(); // no primary-looking CTA on the demoted section
    const moreOptions = screen.getByText("ตัวเลือกคัดลอก").closest("details");
    expect(moreOptions?.open).toBe(false);
    fireEvent.click(screen.getByText("ตัวเลือกคัดลอก"));
    expect(moreOptions?.open).toBe(true);
    expect(screen.getByRole("button", { name: "10 คู่ + เบิ้ล" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "15 คู่ + เบิ้ล" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "21 คู่ + เบิ้ล" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "50 คู่ + เบิ้ล" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "21 คู่ + เบิ้ล" }));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("05 17 24 19 09 33 28 18 56 49 12 44 68 03 27 57 11 39 06 88 60"));
    expect(screen.getByText("เลขเบิ้ลเด่น")).toBeTruthy();
    expect(screen.getByLabelText("เลขเบิ้ลเด่น 33 44 11").children).toHaveLength(3);
    const copyDoublesOnly = screen.getByRole("button", { name: "เฉพาะเลขเบิ้ล" });
    fireEvent.click(copyDoublesOnly);
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("33 44 11"));

    expect(screen.getByLabelText("วิน 6 จากคู่เน้น 1 2 9 0 8 7").children).toHaveLength(6);
    expect(screen.getByRole("button", { name: "คัดลอกชุดจาก 21 คู่แรก" })).toBeTruthy();
    expect(pairButton.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(pairButton);
    expect(pairButton.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("คู่ไม่เบิ้ล · 15 คู่")).toBeTruthy();
    expect(screen.getByText("เลขเบิ้ล · 6 คู่")).toBeTruthy();
    expect(screen.getByRole("button", { name: "คัดลอกทั้งหมด 21 คู่" })).toBeTruthy();
    expect(screen.getByText("โครงสร้างคะแนน และรายละเอียดการคำนวณ")).toBeTruthy();
    expect(screen.getByText("อันดับ 6 กับอันดับ 7 ต่างกัน 0.42 จุด")).toBeTruthy();

    // Switching the hero's 5/6/7 selector must not change the Win-6-derived play set.
    fireEvent.click(screen.getByRole("button", { name: "7" }));
    expect(screen.getByLabelText("วินรวมทุกหวย 7 1 9 3 5 8 2").children).toHaveLength(7);
    expect(screen.getByRole("button", { name: "ดูชุดทั้งหมด 28 คู่" })).toBeTruthy();
    expect(Array.from(screen.getByLabelText(/ชุดวิน 6/).querySelectorAll(".global-win-frequent-pair-list:not(.doubles) b"), (item) => item.textContent)).toEqual(win6NonDoubles);
    expect(screen.getByText(/ตัวเลขทั้งหมดมาจากสถิติย้อนหลัง/).textContent).toContain("ไม่ใช่ค่าความน่าจะเป็นของงวดถัดไป");
  });

  function globalWeekdayWinFixture(overrides: Record<string, unknown> = {}) {
    return {
      ok: true,
      weekday: 2,
      weekdayLabel: "วันอังคาร",
      digits: ["7", "1", "9", "3", "5", "8"].map((digit) => ({ digit, score: 0.2, topRate: 0.2, bottomRate: 0.2 })),
      rankedDigits: ["7", "1", "9", "3", "5", "8", "2", "4", "0", "6"].map((digit) => ({ digit, score: 0.2, topRate: 0.2, bottomRate: 0.2 })),
      lotteryCount: 37,
      topLotteryCount: 37,
      bottomLotteryCount: 35,
      topDrawCount: 400,
      bottomDrawCount: 380,
      lookbackPerLottery: 12,
      cutoffDate: "2026-09-01",
      sufficient: true,
      sourcePoolCount: 37,
      scoreDistribution: {
        rankedScores: ["7", "1", "9", "3", "5", "8", "2", "4", "0", "6"].map((digit, index) => ({ rank: index + 1, digit, score: 0.2 - index * 0.001 })),
        rank6To7Gap: 0.0042,
        top6Spread: 0.01,
        allDigitSpread: 0.02,
        normalizedEntropy: 0.99,
        concentration: 0.01,
      },
      frequentPairs: [],
      frequentDoubles: [],
      pairDerivedDigits: [],
      ...overrides,
    };
  }

  it("shows played-universe copy and the configured/eligible source counts when Production resolves the Played Universe", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => globalWeekdayWinFixture({
        eligibility: { totalCatalog: 151, historiesAvailable: 40, eligible: 35, excluded: 2, exclusionReasons: {}, latestSyncTimestamp: null },
        universe: { mode: "played", weekday: 2, configuredCount: 37, eligibleCount: 35 },
      }),
    }));
    render(<GlobalWeekdayWinCard />);
    expect(await screen.findByText("คำนวณจากหวยที่เล่นวันนี้")).toBeTruthy();
    expect(screen.getByText("ใช้ข้อมูลย้อนหลังของหวยในรายการที่เล่นวันนี้")).toBeTruthy();
    expect(screen.getByText("รายการที่เล่น 37 หวย · ใช้คำนวณวันนี้ 35 หวย")).toBeTruthy();
  });

  it("shows the Dynamic All Eligible fallback copy when Sunday has no configured Played Universe", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => globalWeekdayWinFixture({
        weekday: 0,
        weekdayLabel: "วันอาทิตย์",
        eligibility: { totalCatalog: 151, historiesAvailable: 40, eligible: 90, excluded: 61, exclusionReasons: {}, latestSyncTimestamp: null },
        universe: { mode: "all_eligible_fallback", weekday: 0, configuredCount: 151, eligibleCount: 90 },
      }),
    }));
    render(<GlobalWeekdayWinCard />);
    expect(await screen.findByText("ยังไม่มีรายการหวยที่เล่นสำหรับวันนี้ จึงใช้ข้อมูลรอบโลก")).toBeTruthy();
    expect(screen.getByText("รายการที่เล่น 151 หวย · ใช้คำนวณวันนี้ 90 หวย")).toBeTruthy();
    expect(screen.queryByText(/แม่นกว่า|โอกาสสูงกว่า|เพิ่มโอกาส|สูตรดีกว่า/)).toBeNull();
  });

  it("uses a native disclosure that opens without hiding its content from the DOM", () => {
    render(<AnalysisDisclosure label="ดูเหตุผล"><p>รายละเอียดเลข</p></AnalysisDisclosure>);
    const disclosure = screen.getByText("ดูเหตุผล").closest("details");
    expect(disclosure?.open).toBe(false);
    fireEvent.click(screen.getByText("ดูเหตุผล"));
    expect(disclosure?.open).toBe(true);
    expect(screen.getByText("รายละเอียดเลข")).toBeTruthy();
  });

  it("keeps four primary mobile destinations and moves secondary items under More", () => {
    const items = [
      { id: "analyze", label: "วิเคราะห์", icon: Sparkles },
      { id: "live", label: "ผลสด", icon: RadioTower },
      { id: "statistics", label: "สถิติ", icon: BarChart3 },
      { id: "history", label: "ย้อนหลัง", icon: History },
      { id: "backtest", label: "ทดสอบ", icon: TestTube2 },
      { id: "settings", label: "ตั้งค่า", icon: Settings },
    ] as const;
    render(<MobileNavigation items={items} active="analyze" onNavigate={() => undefined} />);
    const navigation = screen.getByRole("navigation", { name: "เมนูหลัก" });
    expect(within(navigation).getAllByRole("button")).toHaveLength(5);
    expect(within(navigation).getByText("ผลสด")).toBeTruthy();
    expect(within(navigation).getByText("เพิ่มเติม")).toBeTruthy();
    expect(screen.queryByText("ตั้งค่า")).toBeNull();
  });
});
