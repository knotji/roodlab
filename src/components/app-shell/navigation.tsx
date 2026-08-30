"use client";

import type { LucideIcon } from "lucide-react";
import { Database, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type NavigationItem<T extends string> = { id: T; label: string; icon: LucideIcon };

export function AppSidebar<T extends string>({ items, active, onNavigate, statusTitle, statusDetail }: { items: readonly NavigationItem<T>[]; active: T; onNavigate: (id: T) => void; statusTitle: string; statusDetail: string }) {
  return <aside className="sidebar" aria-label="เมนูหลัก"><div className="brand"><span aria-hidden="true">R</span><div><strong>RoodLab</strong><small>Statistical explorer</small></div></div><nav>{items.map((item) => <Button variant="ghost" size="auto" key={item.id} className={cn(active === item.id && "active")} onClick={() => onNavigate(item.id)} aria-current={active === item.id ? "page" : undefined}><item.icon />{item.label}</Button>)}</nav><div className="sidebar-note"><Database /><div><strong>{statusTitle}</strong><small>{statusDetail}</small></div></div></aside>;
}

export function MobileNavigation<T extends string>({ items, active, onNavigate }: { items: readonly NavigationItem<T>[]; active: T; onNavigate: (id: T) => void }) {
  const primary = items.filter((item) => ["analyze", "statistics", "history", "backtest"].includes(item.id));
  const secondary = items.filter((item) => !primary.includes(item));
  return <nav className="mobile-nav" aria-label="เมนูหลัก">{primary.map((item) => <Button variant="ghost" size="auto" key={item.id} className={cn(active === item.id && "active")} onClick={() => onNavigate(item.id)} aria-current={active === item.id ? "page" : undefined}><item.icon /><span>{item.label}</span></Button>)}<Sheet><SheetTrigger asChild><Button variant="ghost" size="auto" className={cn(secondary.some((item) => item.id === active) && "active")}><MoreHorizontal /><span>เพิ่มเติม</span></Button></SheetTrigger><SheetContent><SheetTitle>เมนูเพิ่มเติม</SheetTitle><SheetDescription>หลักฐานล่วงหน้าและการตั้งค่าระบบ</SheetDescription><div className="mt-5 grid gap-2">{secondary.map((item) => <SheetClose asChild key={item.id}><Button variant="ghost" className="h-12 justify-start px-3" onClick={() => onNavigate(item.id)}><item.icon className="size-5" />{item.label}</Button></SheetClose>)}</div></SheetContent></Sheet></nav>;
}
