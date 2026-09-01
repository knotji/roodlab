import type { Snapshot } from "./cache";
import { isCompleteDraw } from "./data-sources/integrity";
import { LIVE_RESULT_SOURCES } from "./live-results";
import type { LotteryDefinition } from "./types";

export type LiveBoardStatus = "resulted" | "upcoming" | "waiting" | "delayed" | "unscheduled";
export type LiveBoardItem = { id:string; name:string; category:string; resultAt:string|null; closeAt:string|null; resultUrl:string|null; backupUrl:string|null; sourceUrl:string; status:LiveBoardStatus; resultMinutes:number|null; drawDate:string|null; top3:string|null; top2:string|null; bottom2:string|null; syncedAt:string|null };

export function resultStartMinutes(value: string | undefined) {
  const match = value?.match(/^(\d{2}):(\d{2})/); return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function bangkokClock(at = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Bangkok", year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hourCycle:"h23" }).formatToParts(at).map((part) => [part.type, part.value]));
  return { date:`${parts.year}-${parts.month}-${parts.day}`, minutes:Number(parts.hour) * 60 + Number(parts.minute) };
}

export function buildLiveBoard(catalog: LotteryDefinition[], snapshots: Record<string, Snapshot>, at = new Date()): LiveBoardItem[] {
  const now = bangkokClock(at);
  return catalog.filter((lottery) => lottery.isActive !== false).map((lottery) => {
    const schedule = LIVE_RESULT_SOURCES[lottery.id], snapshot = snapshots[lottery.id], resultMinutes = resultStartMinutes(schedule?.resultAt),
      outcome = snapshot?.draws.find((draw) => draw.drawDate === now.date && isCompleteDraw(draw)) ?? null;
    let status: LiveBoardStatus = "unscheduled";
    if (outcome) status = "resulted";
    else if (resultMinutes !== null) status = now.minutes < resultMinutes ? "upcoming" : now.minutes <= resultMinutes + 60 ? "waiting" : "delayed";
    return { id:lottery.id, name:lottery.name, category:lottery.category, resultAt:schedule?.resultAt ?? null, closeAt:schedule?.closeAt ?? null, resultUrl:schedule?.url ?? null, backupUrl:schedule?.backupUrl ?? null, sourceUrl:lottery.sourceUrl, status, resultMinutes, drawDate:outcome?.drawDate ?? null, top3:outcome?.top3 ?? null, top2:outcome?.top2 ?? null, bottom2:outcome?.bottom2 ?? null, syncedAt:snapshot?.syncedAt ?? null };
  }).sort((a,b) => (a.resultMinutes ?? 9999) - (b.resultMinutes ?? 9999) || a.name.localeCompare(b.name,"th"));
}

export function nearDueIds(items: LiveBoardItem[], at = new Date(), limit = 6) {
  const now = bangkokClock(at).minutes;
  return items.filter((item) => item.resultMinutes !== null && item.status !== "resulted" && now >= item.resultMinutes - 20 && now <= item.resultMinutes + 90).slice(0, limit).map((item) => item.id);
}
