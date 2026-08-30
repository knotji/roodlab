"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export function SheetContent({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return <DialogPrimitive.Portal><DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-[#101714]/45 backdrop-blur-[2px]" /><DialogPrimitive.Content className={cn("fixed inset-x-0 bottom-0 z-[101] max-h-[82dvh] overflow-y-auto rounded-t-[24px] border border-[var(--border)] bg-[var(--card)] px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-4 shadow-[var(--shadow-lg)] outline-none", className)} {...props}><div className="mx-auto mb-5 h-1 w-10 rounded-full bg-[var(--border-strong)]" />{children}<DialogPrimitive.Close aria-label="ปิด" className="absolute right-4 top-4 grid size-10 place-items-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)]"><X className="size-4" /></DialogPrimitive.Close></DialogPrimitive.Content></DialogPrimitive.Portal>;
}
export function SheetTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) { return <DialogPrimitive.Title className={cn("text-lg font-semibold text-[var(--foreground)]", className)} {...props} />; }
export function SheetDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) { return <DialogPrimitive.Description className={cn("mt-1 text-sm text-[var(--muted-foreground)]", className)} {...props} />; }
