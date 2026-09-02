// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { BarChart3, History, RadioTower, Settings, Sparkles, TestTube2 } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileNavigation } from "@/components/app-shell/navigation";
import type { PairSignal } from "@/lib/analysis/types";
import { AnalysisDisclosure } from "./analysis-disclosure";
import { AnalyzeControls } from "./analyze-controls";
import { GlobalWeekdayWinCard } from "./global-weekday-win-card";
import { PairSection } from "./pair-section";
import { StandoutHero } from "./standout-hero";
import { WindowSelector } from "./window-selector";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Analyze presentation", () => {
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
        sourcePoolCount: 46,
        scoreDistribution: {
          rankedScores: ["7", "1", "9", "3", "5", "8", "2", "4", "0", "6"].map((digit, index) => ({ rank: index + 1, digit, score: 0.2 - index * 0.001 })),
          rank6To7Gap: 0.0042,
          top6Spread: 0.01,
          allDigitSpread: 0.02,
          normalizedEntropy: 0.99,
          concentration: 0.01,
        },
        global411: {
          digits: ["7", "1", "9", "3", "2", "4"].map((digit) => ({ digit, score: 0.2, topRate: 0.2, bottomRate: 0.2 })),
          core: ["7", "1", "9", "3"].map((digit) => ({ digit, score: 0.2, topRate: 0.2, bottomRate: 0.2 })),
          topExtra: { digit: "2", score: 0.2, topRate: 0.3, bottomRate: 0.1 },
          bottomExtra: { digit: "4", score: 0.2, topRate: 0.1, bottomRate: 0.3 },
        },
      }),
    }));
    render(<GlobalWeekdayWinCard />);
    expect(await screen.findByRole("heading", { name: "วินรวมทุกหวย · วันอังคาร" })).toBeTruthy();
    expect(screen.getByLabelText("วินรวมทุกหวย 7 1 9 3 5 8").children).toHaveLength(6);
    const pairButton = screen.getByRole("button", { name: "ดูชุดทั้งหมด 21 คู่" });
    expect(pairButton.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(pairButton);
    expect(pairButton.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("คู่ไม่เบิ้ล · 15 คู่")).toBeTruthy();
    expect(screen.getByText("เลขเบิ้ล · 6 คู่")).toBeTruthy();
    expect(screen.getByRole("button", { name: "คัดลอกทั้งหมด 21 คู่" })).toBeTruthy();
    expect(screen.getByText("โครงสร้างคะแนนวันนี้")).toBeTruthy();
    expect(screen.getByText("อันดับ 6 กับอันดับ 7 ต่างกัน 0.42 จุด")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "7" }));
    expect(screen.getByLabelText("วินรวมทุกหวย 7 1 9 3 5 8 2").children).toHaveLength(7);
    expect(screen.getByRole("button", { name: "ดูชุดทั้งหมด 28 คู่" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "4+1+1" }));
    expect(screen.getByLabelText("วินรวมทุกหวย 7 1 9 3 2 4").children).toHaveLength(6);
    expect(screen.getByText("แกนรวม 4").textContent).toContain("7 · 1 · 9 · 3");
    const disclosure = screen.getByText((_, element) => element?.tagName === "SMALL" && element.textContent?.includes("จัดอันดับจากรูปแบบย้อนหลังของหวยรายวัน") === true);
    expect(disclosure.textContent).toContain("ใช้เพื่อสำรวจข้อมูล ไม่ใช่ค่าความน่าจะเป็น");
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
