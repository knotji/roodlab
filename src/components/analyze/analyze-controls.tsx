"use client";

import { Button } from "@/components/ui/button";
import { WindowSelector } from "./window-selector";
import { DAY_PATTERN_OPTIONS, dayPatternLabel, type DayPattern } from "@/lib/analysis/day-pattern";
import { cn } from "@/lib/utils";

export function AnalyzeControls({ windowSize, onWindowChange, dayPattern, onDayPatternChange, sampleSize, minimumDayDraws }: { windowSize: number; onWindowChange: (value: number) => void; dayPattern: DayPattern; onDayPatternChange: (value: DayPattern) => void; sampleSize: number; minimumDayDraws: number }) {
  return <section className="analyze-control-panel" aria-label="ตัวเลือกการวิเคราะห์"><div><span>ช่วงข้อมูลย้อนหลัง</span><WindowSelector value={windowSize} onChange={onWindowChange} /></div><div><span>กรองตามวัน</span><div className="day-pattern-options" role="group" aria-label="เลือกวันออกรางวัล">{DAY_PATTERN_OPTIONS.map((option) => <Button variant="ghost" size="auto" type="button" key={String(option.value)} className={cn(dayPattern === option.value && "active")} aria-pressed={dayPattern === option.value} onClick={() => onDayPatternChange(option.value)} title={option.label}>{option.shortLabel}</Button>)}</div></div><p>{dayPattern === "all" ? `ใช้ผลย้อนหลังทุกวัน · ${windowSize} งวดล่าสุด` : `เฉพาะงวด${dayPatternLabel(dayPattern)} · พบ ${sampleSize} งวด${sampleSize < minimumDayDraws ? ` · ต้องมีอย่างน้อย ${minimumDayDraws} งวด` : " · สถิติเชิงสำรวจ"}`}<small>เปรียบเทียบรูปแบบย้อนหลัง ไม่ใช่ความน่าจะเป็น</small></p></section>;
}
