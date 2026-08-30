import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="offline-page">
      <div className="offline-mark">R</div>
      <p>ROODLAB</p>
      <h1>ยังเชื่อมต่ออินเทอร์เน็ตไม่ได้</h1>
      <span>หน้าที่เคยเปิดอาจยังใช้งานได้ แต่การซิงก์และดูผลสดต้องเชื่อมต่ออินเทอร์เน็ต</span>
      <Link href="/">ลองอีกครั้ง</Link>
    </main>
  );
}
