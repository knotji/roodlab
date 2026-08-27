import { readAllSnapshots,readCatalog,readCatalogAudit } from "@/lib/cache";import Dashboard from "@/components/dashboard";
export const dynamic="force-dynamic";
export default async function Home(){const auditStatuses=await readCatalogAudit(),catalog=(await readCatalog()).map(item=>auditStatuses[item.id]?.status==="partial"?{...item,category:"ข้อมูลบางประเภทไม่ครบ"}:item);return <Dashboard catalog={catalog} initialSnapshots={await readAllSnapshots()} auditStatuses={auditStatuses}/>}
