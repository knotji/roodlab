"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ResearchTab = "results" | "lab";
export function ResearchTabs({ value, onChange }: { value: ResearchTab; onChange: (value: ResearchTab) => void }) {
  return <div className="lab-tabs" role="tablist" aria-label="เครื่องมือทดสอบ"><Button variant="plain" size="auto" type="button" role="tab" aria-selected={value === "results"} className={cn(value === "results" && "active")} onClick={() => onChange("results")}>ผลทดสอบ</Button><Button variant="plain" size="auto" type="button" role="tab" aria-selected={value === "lab"} className={cn(value === "lab" && "active")} onClick={() => onChange("lab")}>เปรียบเทียบสูตร</Button></div>;
}
