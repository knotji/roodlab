import Dashboard from "@/components/dashboard";
import { currentBangkokWeekday } from "@/lib/analysis/day-pattern";
import { readCatalog, readCatalogAudit, readSnapshot } from "@/lib/cache";

export default async function Home({ searchParams }: { searchParams: Promise<{ lottery?: string }> }) {
  const [auditStatuses, rawCatalog, params] = await Promise.all([
    readCatalogAudit(),
    readCatalog(),
    searchParams,
  ]);
  const catalog = rawCatalog.map((item) =>
      auditStatuses[item.id]?.status === "partial"
        ? { ...item, category: "ข้อมูลบางประเภทไม่ครบ" }
        : item,
    ),
    requestedId = params.lottery,
    initialId = catalog.some((item) => item.id === requestedId)
      ? requestedId!
      : (catalog[0]?.id ?? ""),
    initialSnapshot = initialId ? await readSnapshot(initialId) : null;

  return (
    <Dashboard
      catalog={catalog}
      initialSnapshots={initialSnapshot ? { [initialId]: initialSnapshot } : {}}
      initialSelectedId={initialId}
      auditStatuses={auditStatuses}
      defaultDayPattern={currentBangkokWeekday()}
    />
  );
}
