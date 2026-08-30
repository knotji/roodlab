"use client";

import { Search } from "lucide-react";
import type { LotteryDraw } from "@/lib/types";

export function HistoryPage({ draws, search, setSearch, visible, setVisible }: { draws: LotteryDraw[]; search: string; setSearch: (value: string) => void; visible: number; setVisible: (value: number) => void }) {
  return <div className="content history-page"><div className="section-head"><div><div className="section-kicker">HISTORICAL DRAWS</div><h2>ผลย้อนหลัง</h2><p>ข้อมูลย้อนหลังเรียงจากงวดล่าสุด</p></div><label className="search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาวันที่หรือเลข" aria-label="ค้นหาผลย้อนหลัง" /></label></div><div className="history-list" role="list">{draws.slice(0, visible).map((draw) => <article key={draw.id} role="listitem"><time dateTime={draw.drawDate}>{new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${draw.drawDate}T12:00:00.000Z`))}</time><div className="history-numbers"><span><small>3 ตัวบน</small><strong>{draw.top3 ?? "--"}</strong></span><span><small>2 ตัวบน</small><strong>{draw.top2 ?? "--"}</strong></span><span><small>2 ตัวล่าง</small><strong>{draw.bottom2 ?? "--"}</strong></span></div>{draw.source && <small className="history-source" title={`Source: ${draw.source}`}>{draw.source === "current-result" ? "ผลล่าสุดจากต้นทาง" : "ประวัติจากต้นทาง"}</small>}</article>)}</div>{visible < draws.length && <button type="button" className="load" onClick={() => setVisible(visible + 20)}>แสดงเพิ่ม</button>}</div>;
}
