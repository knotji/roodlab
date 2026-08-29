import { NextResponse } from "next/server";
import { listAllProspective, type ProspectiveRecord } from "@/lib/prospective";

const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

function toCsv(records: ProspectiveRecord[]) {
  const header = ["lotteryId", "drawDate", "createdAt", "historyVersion", "algorithmVersion", "window", "dayPattern", "standoutDigits", "topPairs", "bottomPairs", "outcomeTop2", "outcomeBottom2", "outcomeRecordedAt"],
    rows = records.map((record) => [
      record.lotteryId,
      record.drawDate,
      record.createdAt,
      record.historyVersion,
      record.algorithmVersion,
      record.analysisOptions.window,
      record.analysisOptions.dayPattern,
      record.standoutDigits.join(" "),
      record.rankedPairs.top.join(" "),
      record.rankedPairs.bottom.join(" "),
      record.outcome?.top2,
      record.outcome?.bottom2,
      record.outcome?.recordedAt,
    ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

export async function GET(request: Request) {
  try {
    const records = await listAllProspective(), format = new URL(request.url).searchParams.get("format");
    if (format === "csv") return new Response(`\uFEFF${toCsv(records)}`, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="roodlab-prospective.csv"' } });
    if (format === "json") return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), records }, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": 'attachment; filename="roodlab-prospective.json"' } });
    return NextResponse.json({ ok: true, records });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "อ่าน prospective dataset ไม่สำเร็จ" }, { status: 503 });
  }
}

