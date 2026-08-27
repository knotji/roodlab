import { NextResponse } from "next/server";import { AllHuayDataSource } from "@/lib/data-sources/allhuay";import { readCatalog,writeCatalog } from "@/lib/cache";
export async function GET(){return NextResponse.json({ok:true,lotteries:await readCatalog()});}
export async function POST(){try{const lotteries=await new AllHuayDataSource().getLotteries();await writeCatalog(lotteries);return NextResponse.json({ok:true,count:lotteries.length,lotteries});}catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"รีเฟรช catalog ไม่สำเร็จ"},{status:502});}}
