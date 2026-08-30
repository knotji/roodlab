// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResearchTabs } from "./backtest/research-tabs";
import { HistoryPage } from "./history/history-page";
import { DigitStrengthGrid } from "./statistics/digit-strength-grid";
import { useLotteryStore } from "@/lib/lottery-store";
import type { DigitSignal } from "@/lib/analysis/types";

afterEach(cleanup);

const digit = (value: string): DigitSignal => ({ digit: value, score: 72, rank: 1, frequencyRank: 1, positionRank: 1, components: { frequency: 1, recentFrequency: 1, momentum: 1, positionStrength: 1, gapPattern: 1 }, counts: { 30: 8 }, recent10: 3, previous10: 2, trend: "ทรงตัว", momentum: 1, gap: 2, averageGap: 3, longestGap: 7, strongestPosition: "หลักหน่วย", pairSupport: 1, reasons: [] });

describe("remaining redesigned surfaces", () => {
  it("renders the complete Statistics digit range compactly", () => {
    render(<DigitStrengthGrid digits={Array.from({ length: 10 }, (_, index) => digit(String(index)))} onSelect={() => undefined} />);
    expect(screen.getAllByRole("button")).toHaveLength(10);
    expect(screen.getByRole("button", { name: "เลข 0 คะแนนย้อนหลัง 72" })).toBeTruthy();
  });

  it("preserves leading-zero History values in stacked semantic rows", () => {
    const { container } = render(<HistoryPage draws={[{ id: "a", lotteryId: "lottery", drawDate: "2026-08-30", top3: "005", top2: "05", bottom2: "09", source: "historical-table" }]} search="" setSearch={() => undefined} visible={20} setVisible={() => undefined} />);
    expect(screen.getByText("005")).toBeTruthy();
    expect(screen.getByText("05")).toBeTruthy();
    expect(screen.getByText("09")).toBeTruthy();
    expect(container.querySelector(".history-numbers")).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("switches between Backtest and Formula Lab without changing calculations", () => {
    const onChange = vi.fn();
    render(<ResearchTabs value="results" onChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "เปรียบเทียบสูตร" }));
    expect(onChange).toHaveBeenCalledWith("lab");
  });

  it("keeps the persisted algorithm setting contract", () => {
    useLotteryStore.getState().setAlgorithm("frequency");
    const stored = JSON.parse(localStorage.getItem("roodlab-lottery-store") ?? "{}");
    expect(stored.state.algorithmId).toBe("frequency");
    useLotteryStore.getState().setAlgorithm("balanced-v1");
  });
});
