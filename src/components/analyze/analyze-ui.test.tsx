// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { BarChart3, History, Settings, Sparkles, TestTube2 } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileNavigation } from "@/components/app-shell/navigation";
import type { PairSignal } from "@/lib/analysis/types";
import { AnalysisDisclosure } from "./analysis-disclosure";
import { PairSection } from "./pair-section";
import { StandoutHero } from "./standout-hero";
import { WindowSelector } from "./window-selector";

afterEach(cleanup);

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
      { id: "statistics", label: "สถิติ", icon: BarChart3 },
      { id: "history", label: "ย้อนหลัง", icon: History },
      { id: "backtest", label: "ทดสอบ", icon: TestTube2 },
      { id: "settings", label: "ตั้งค่า", icon: Settings },
    ] as const;
    render(<MobileNavigation items={items} active="analyze" onNavigate={() => undefined} />);
    const navigation = screen.getByRole("navigation", { name: "เมนูหลัก" });
    expect(within(navigation).getAllByRole("button")).toHaveLength(5);
    expect(within(navigation).getByText("เพิ่มเติม")).toBeTruthy();
    expect(screen.queryByText("ตั้งค่า")).toBeNull();
  });
});
