import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AnalysisDisclosure({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return <details className={cn("analyze-disclosure", className)}><summary>{label}</summary>{children}</details>;
}
