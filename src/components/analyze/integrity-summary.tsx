import type { DataIntegritySummary } from "@/lib/data-sources/integrity";

export function IntegritySummary({ integrity }: { integrity: DataIntegritySummary }) {
  const text = integrity.status === "complete" ? `ข้อมูลครบ ${integrity.usableDraws}/${integrity.requestedDraws} งวด` : `ข้อมูลใช้วิเคราะห์ได้ ${integrity.usableDraws}/${integrity.requestedDraws} งวด`;
  return <small className="analysis-integrity" title={`${integrity.partialDraws} งวดข้อมูลไม่ครบ · ${integrity.invalidDraws} งวดถูกตัดออกจากการวิเคราะห์`}>{text}</small>;
}
