export function CoverageSummary({ rate, hits, total, showMethodNote }: { rate: number | null; hits: number; total: number; showMethodNote: boolean }) {
  return <div className="win-coverage" title="สรุปข้อมูลชุดเดียวกับที่ใช้คัดเลข ไม่ใช่การทดสอบย้อนหลังหรือโอกาสงวดหน้า"><div><span>ความครอบคลุมของข้อมูลที่ใช้คัด</span><strong>{rate === null ? "--" : `${Math.round(rate * 100)}%`}</strong><small>{hits}/{total} งวด · สถิติเชิงพรรณนา</small></div>{showMethodNote && <p>ใช้ข้อมูลชุดเดียวกับที่คัด · ไม่ใช่ผล backtest หรือโอกาสงวดหน้า</p>}</div>;
}
