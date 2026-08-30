"use client";

import { Button } from "./button";
import { cn } from "@/lib/utils";

export function SegmentedControl<T extends string | number>({ values, value, onChange, label }: { values: readonly { value: T; label: string }[]; value: T; onChange: (value: T) => void; label?: string }) {
  return <div className="segment" role="group" aria-label={label}>{values.map((item) => <Button variant="plain" size="auto" type="button" key={String(item.value)} className={cn(item.value === value && "active")} aria-pressed={item.value === value} onClick={() => onChange(item.value)}>{item.label}</Button>)}</div>;
}
