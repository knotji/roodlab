"use client";

import type { PairSignal } from "@/lib/analysis/types";

function PairColumn({ title, items, onSelect }: { title: string; items: PairSignal[]; onSelect: (pair: PairSignal) => void }) {
  return <section className="pair-card"><div className="section-kicker">{title}</div>{items.map((item, index) => <button type="button" className="pair-row" key={item.pair} onClick={() => onSelect(item)}><span className="pair-rank">{String(index + 1).padStart(2, "0")}</span><strong>{item.pair}</strong><span>อันดับจากข้อมูล {item.score.toFixed(1)}</span></button>)}</section>;
}

export function PairSection({ top, bottom, onSelect }: { top: PairSignal[]; bottom: PairSignal[]; onSelect: (pair: PairSignal) => void }) {
  return <><div className="section-kicker pair-section-title">คู่ที่น่าสนใจจากสถิติ</div><div className="pair-grid"><PairColumn title="บน" items={top} onSelect={onSelect} /><PairColumn title="ล่าง" items={bottom} onSelect={onSelect} /></div><p className="pair-method-note">จัดอันดับจากความแข็งแรงของเลขและความเหมาะสมตามตำแหน่ง เป็นการสำรวจรูปแบบย้อนหลัง ไม่ใช่การทำนายผล</p></>;
}
