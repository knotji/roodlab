import { CalendarDays } from "lucide-react";
import type { ReactNode } from "react";

const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

function formatAnalysisDate(value?: string) {
  if (!value) return "ยังไม่มีวันที่วิเคราะห์";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return `${day} ${THAI_MONTHS[month - 1]} ${year + 543}`;
}

export function AnalyzePageLayout({ analysisDate, globalDaily, perLotteryHeader, children, showPerLottery = true }: { analysisDate?: string; globalDaily: ReactNode; perLotteryHeader: ReactNode; children: ReactNode; showPerLottery?: boolean }) {
  return <div className="content analyze analyze-global-first">
    <header className="analyze-page-header">
      <div><div className="eyebrow">LOTTERY ANALYSIS</div><h1>วิเคราะห์เลข</h1><p>วิเคราะห์จากสถิติย้อนหลังของทุกหวย ไม่มีการทำนายผล</p></div>
      <div className="analyze-date"><span>วันที่วิเคราะห์</span><strong>{formatAnalysisDate(analysisDate)}</strong><CalendarDays /></div>
    </header>
    {showPerLottery && <nav className="analyze-page-tabs" aria-label="ส่วนต่าง ๆ ในหน้าวิเคราะห์">
      <a className="active" href="#global-daily">Global Daily</a>
      <a href="#per-lottery-analysis">รายหวย</a>
      <a href="#per-lottery-pairs">จับคู่เลข</a>
      <a href="#additional-analysis">วิเคราะห์เพิ่มเติม</a>
    </nav>}
    <div id="global-daily">{globalDaily}</div>
    {showPerLottery && <section className="per-lottery-section" id="per-lottery-analysis">
      <div className="per-lottery-title"><div className="section-kicker">LOTTERY DETAIL</div><h2>วิเคราะห์รายหวย</h2><p>เลือกหวยและสำรวจรูปแบบจากประวัติของรายการนั้น</p></div>
      {perLotteryHeader}
      {children}
    </section>}
  </div>;
}
