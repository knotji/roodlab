import { NextResponse } from "next/server";
import { checkLotteryFreshness } from "@/lib/data-sources/allhuay/freshness";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ lotteryId: string }> },
) {
  const { lotteryId } = await params;
  try {
    const freshness = await checkLotteryFreshness(lotteryId);
    return NextResponse.json({ ok: true, freshness });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "ตรวจสอบความสดไม่สำเร็จ",
      },
      { status: 502 },
    );
  }
}
