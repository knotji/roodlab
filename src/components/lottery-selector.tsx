"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, RefreshCw, Search, Star } from "lucide-react";
import type { LotteryDefinition } from "@/lib/types";
import { searchLotteries } from "@/lib/data-sources/allhuay/catalog";
import { useLotteryStore } from "@/lib/lottery-store";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "./ui/sheet";

type Props = { catalog: LotteryDefinition[]; selectedId: string; onSelect: (id: string) => void; onRefresh: () => void; refreshing: boolean; auditStatuses?: Record<string, { status: string; reason?: string }> };

export function LotterySelector({ catalog, selectedId, onSelect, onRefresh, refreshing, auditStatuses = {} }: Props) {
  const [desktopOpen, setDesktopOpen] = useState(false), [mobileOpen, setMobileOpen] = useState(false), [query, setQuery] = useState("");
  const { recentLotteryIds, favoriteLotteryIds, toggleFavorite } = useLotteryStore();
  const selected = catalog.find((item) => item.id === selectedId), filtered = useMemo(() => searchLotteries(catalog, query), [catalog, query]);
  const byId = (ids: string[]) => ids.map((id) => catalog.find((item) => item.id === id)).filter(Boolean) as LotteryDefinition[];
  const recentOnly = recentLotteryIds.filter((id) => !favoriteLotteryIds.includes(id));
  const groups = Object.entries(filtered.reduce<Record<string, LotteryDefinition[]>>((result, item) => { (result[item.category] ??= []).push(item); return result; }, {}));
  const choose = (id: string) => { onSelect(id); setDesktopOpen(false); setMobileOpen(false); setQuery(""); };
  const renderItems = (items: LotteryDefinition[]) => items.map((item) => <CommandItem key={item.id} className="lottery-option" value={`${item.name} ${item.slug}`} onSelect={() => choose(item.id)}><Check className={item.id === selectedId ? "visible" : "hidden"} /><span className="lottery-item-copy"><strong>{item.name}</strong><small>{auditStatuses[item.id]?.status === "partial" ? "ข้อมูลบางประเภทไม่ครบ" : item.category}</small></span><Button variant="ghost" size="auto" type="button" className={favoriteLotteryIds.includes(item.id) ? "favorite on" : "favorite"} aria-label={`รายการโปรด ${item.name}`} onPointerDown={(event) => event.preventDefault()} onClick={(event) => { event.stopPropagation(); toggleFavorite(item.id); }}><Star /></Button></CommandItem>);
  const pickerContent = () => <Command shouldFilter={false}><div className="command-search"><Search /><CommandInput value={query} onValueChange={setQuery} placeholder="ค้นหาหวย..." aria-label="ค้นหาหวย" /></div><CommandList><CommandEmpty>ไม่พบหวยที่ค้นหา</CommandEmpty>{!query && favoriteLotteryIds.length > 0 && <CommandGroup heading="รายการโปรด">{renderItems(byId(favoriteLotteryIds))}</CommandGroup>}{!query && recentOnly.length > 0 && <CommandGroup heading="ล่าสุด">{renderItems(byId(recentOnly))}</CommandGroup>}{groups.map(([category, items]) => <CommandGroup key={category} heading={category}>{renderItems(items)}</CommandGroup>)}</CommandList><Button variant="ghost" size="auto" className="catalog-refresh" onClick={onRefresh} disabled={refreshing}><RefreshCw className={refreshing ? "spin" : ""} />รีเฟรชรายการหวย</Button></Command>;
  const trigger = (open: boolean) => <Button variant="ghost" size="auto" className={`lottery-select ${open ? "open" : ""}`}>{selected?.name ?? "เลือกหวย"}<ChevronDown /></Button>;

  return <div className="lottery-picker"><div className="lottery-picker-desktop"><Popover open={desktopOpen} onOpenChange={setDesktopOpen}><PopoverTrigger asChild>{trigger(desktopOpen)}</PopoverTrigger><PopoverContent>{pickerContent()}</PopoverContent></Popover></div><div className="lottery-picker-mobile"><Sheet open={mobileOpen} onOpenChange={setMobileOpen}><SheetTrigger asChild>{trigger(mobileOpen)}</SheetTrigger><SheetContent className="lottery-picker-sheet"><SheetTitle>เลือกหวย</SheetTitle><SheetDescription>ค้นหาจากชื่อภาษาไทยหรือหมวดหมู่</SheetDescription>{pickerContent()}</SheetContent></Sheet></div></div>;
}
