import { NextResponse } from "next/server";
import { captureProspective, listProspective } from "@/lib/prospective";
import { guardWrite } from "@/lib/write-guard";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ lotteryId: string }> },
) {
  const { lotteryId } = await params;
  try {
    return NextResponse.json({ ok: true, records: await listProspective(lotteryId) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "อ่าน prospective snapshots ไม่สำเร็จ" }, { status: 503 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ lotteryId: string }> },
) {
  const { lotteryId } = await params,
    guard = await guardWrite(request, `prospective:${lotteryId}`, 5);
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  try {
    const result = await captureProspective(lotteryId, await request.json());
    return NextResponse.json({ ok: true, ...result }, { status: result.created ? 201 : 200 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "ล็อก snapshot ไม่สำเร็จ" }, { status: 400 });
  }
}

