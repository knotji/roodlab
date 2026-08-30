"use client";

import type { CSSProperties } from "react";
import type { DigitSignal } from "@/lib/analysis/types";

export function DigitStrengthGrid({ digits, onSelect }: { digits: DigitSignal[]; onSelect: (digit: DigitSignal) => void }) {
  return <section className="digit-strength-section" aria-labelledby="digit-ranking-title"><div className="statistics-subhead"><span>อันดับความแข็งแรง</span><small>แตะตัวเลขเพื่อดูรายละเอียด</small></div><div className="heatmap" id="digit-ranking-title">{[...digits].sort((a, b) => a.digit.localeCompare(b.digit)).map((digit) => <button type="button" key={digit.digit} style={{ "--score": `${digit.score}%` } as CSSProperties} onClick={() => onSelect(digit)} aria-label={`เลข ${digit.digit} คะแนนย้อนหลัง ${digit.score.toFixed(0)}`}><strong>{digit.digit}</strong><span>{digit.score.toFixed(0)}</span></button>)}</div></section>;
}
