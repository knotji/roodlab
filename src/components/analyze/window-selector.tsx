"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const ANALYSIS_WINDOWS = [10, 20, 30, 50, 100] as const;

export function WindowSelector({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <div className="window-selector" role="group" aria-label="ช่วงข้อมูลย้อนหลัง">{ANALYSIS_WINDOWS.map((window) => <Button key={window} type="button" variant="ghost" size="auto" className={cn(value === window && "active")} aria-pressed={value === window} onClick={() => onChange(window)}>{window}<span>งวด</span></Button>)}</div>;
}
