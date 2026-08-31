"use client";

import { Button } from "@/components/ui/button";
import { WindowSelector } from "./window-selector";
import { DAY_PATTERN_OPTIONS, dayPatternLabel, type DayPattern } from "@/lib/analysis/day-pattern";
import { cn } from "@/lib/utils";

export function AnalyzeControls({ windowSize, onWindowChange, dayPattern, onDayPatternChange, sampleSize, minimumDayDraws }: { windowSize: number; onWindowChange: (value: number) => void; dayPattern: DayPattern; onDayPatternChange: (value: DayPattern) => void; sampleSize: number; minimumDayDraws: number }) {
  const dayStatus = sampleSize >= 30
    ? "ข้อมูลเพียงพอสำหรับสำรวจ"
    : sampleSize >= 20
      ? "ข้อมูลค่อนข้างน้อย"
      : "ข้อมูลยังไม่พอวัดความนิ่ง";

  return <section className="analyze-control-panel" aria-label="ตัวเลือกการวิเคราะห์">
    <div className="analyze-control-summary">
      <span>วิเคราะห์จาก</span>
      <strong>{windowSize} งวดล่าสุด · {dayPattern === "all" ? "ทุกวัน" : dayPatternLabel(dayPattern)}</strong>
    </div>
    <details className="analyze-filter-options">
      <summary>ตัวกรองเพิ่มเติม</summary>
      <div><span>ช่วงข้อมูลย้อนหลัง</span><WindowSelector value={windowSize} onChange={onWindowChange} /></div>
      <div><span>กรองตามวัน</span><div className="day-pattern-options" role="group" aria-label="เลือกวันออกรางวัล">{DAY_PATTERN_OPTIONS.map((option) => <Button variant="ghost" size="auto" type="button" key={String(option.value)} className={cn(dayPattern === option.value && "active")} aria-pressed={dayPattern === option.value} onClick={() => onDayPatternChange(option.value)} title={option.label}>{option.shortLabel}</Button>)}</div></div>
    </details>
    <p>{dayPattern === "all" ? "ใช้ข้อมูลทุกวันเพื่อให้มีจำนวนงวดมากและสถิตินิ่งกว่า" : `เฉพาะงวด${dayPatternLabel(dayPattern)} · พบ ${sampleSize} งวด · ${dayStatus}${sampleSize < minimumDayDraws ? ` · ต้องมีอย่างน้อย ${minimumDayDraws} งวดเพื่อวิเคราะห์` : ""}`}<small>ตัวกรองรายวันใช้สำรวจรูปแบบย้อนหลัง ไม่ได้แปลว่าแม่นกว่า</small></p>
  </section>;
}
