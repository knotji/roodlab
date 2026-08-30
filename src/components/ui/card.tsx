import type * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"section">) { return <section data-slot="card" className={cn("rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)]", className)} {...props} />; }
export function CardHeader({ className, ...props }: React.ComponentProps<"header">) { return <header data-slot="card-header" className={cn("grid gap-1.5 p-6", className)} {...props} />; }
export function CardContent({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="card-content" className={cn("p-6 pt-0", className)} {...props} />; }
