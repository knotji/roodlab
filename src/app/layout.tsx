import type { Metadata } from "next";import { Noto_Sans_Thai } from "next/font/google";import "./globals.css";
const noto=Noto_Sans_Thai({subsets:["thai","latin"],variable:"--font-noto"});
export const metadata:Metadata={title:"RoodLab — วิเคราะห์สถิติหวยย้อนหลัง",description:"วิเคราะห์สัญญาณตัวเลขจากข้อมูลย้อนหลังอย่างโปร่งใส พร้อมทดสอบย้อนหลังโดยไม่ใช้ข้อมูลอนาคต"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="th"><body className={noto.variable}>{children}</body></html>;}
