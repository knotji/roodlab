"use client";

import { Button } from "./button";
import { cn } from "@/lib/utils";

export function SegmentedControl<T extends string | number>({ values, value, onChange, label }: { values: readonly { value: T; label: string }[]; value: T; onChange: (value: T) => void; label?: string }) {
  return <div className="inline-flex items-center rounded-lg bg-[var(--muted-surface)] p-1" role="group" aria-label={label}>{values.map((item) => <Button variant="ghost" size="sm" type="button" key={String(item.value)} className={cn("shadow-none", item.value === value && "bg-[var(--background)] text-[var(--foreground)] shadow-sm hover:bg-[var(--background)]")} aria-pressed={item.value === value} onClick={() => onChange(item.value)}>{item.label}</Button>)}</div>;
}
