import type { FreshnessInfo } from "@/lib/freshness";
import type { DataIntegritySummary } from "@/lib/data-sources/integrity";

const formatDrawDate = (drawDate: string) =>
  new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${drawDate}T12:00:00.000Z`));

const formatSyncTime = (syncedAt: string) =>
  new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(syncedAt));

export function LotteryHeaderMeta({
  windowSize,
  latestDrawDate,
  syncedAt,
  freshness,
  syncNotice,
  currentSourceResultDate,
  latestCompleteDrawDate,
  integrity,
  hydrated,
}: {
  windowSize: number;
  latestDrawDate?: string;
  syncedAt?: string;
  freshness: FreshnessInfo | null;
  syncNotice: { addedDraws: number; latest: string } | null;
  currentSourceResultDate?: string | null;
  latestCompleteDrawDate?: string | null;
  integrity: DataIntegritySummary;
  hydrated: boolean;
}) {
  const status = syncNotice ? "synced" : freshness?.status;
  const showSourceHint =
    !syncNotice &&
    freshness?.status === "cache-behind" &&
    freshness.sourceLatestDrawDate;

  return (
    <div className="lottery-header-meta">
      <div className="meta meta-primary">
        <span>{windowSize} งวด</span>
        {latestDrawDate && (
          <>
            <i />
            <span>ข้อมูลถึง {formatDrawDate(latestDrawDate)}</span>
          </>
        )}
        {syncedAt && (
          <>
            <i />
            <span>ซิงก์ {formatSyncTime(syncedAt)}</span>
          </>
        )}
      </div>

      {hydrated && (
        <div className="meta meta-integrity" title={`${integrity.partialDraws} งวดข้อมูลไม่ครบ · ${integrity.invalidDraws} งวดถูกตัดออกจากการวิเคราะห์`}>
          <span>{integrity.status === "complete" ? `ข้อมูลครบ ${integrity.usableDraws}/${integrity.requestedDraws} งวด` : `ข้อมูลใช้วิเคราะห์ได้ ${integrity.usableDraws}/${integrity.requestedDraws} งวด`}</span>
          {currentSourceResultDate && latestCompleteDrawDate && currentSourceResultDate !== latestCompleteDrawDate && <span>ผลล่าสุดจากต้นทาง {formatDrawDate(currentSourceResultDate)} · วิเคราะห์ถึง {formatDrawDate(latestCompleteDrawDate)}</span>}
        </div>
      )}

      {syncNotice && (
        <div className="meta meta-status meta-ok">
          <b>{syncNotice.addedDraws > 0 ? "อัปเดตแล้ว" : "ข้อมูลเป็นปัจจุบันแล้ว"}</b>
          <span>
            {syncNotice.addedDraws > 0
              ? `เพิ่ม ${syncNotice.addedDraws} งวด · ล่าสุด ${formatDrawDate(syncNotice.latest)}`
              : `ล่าสุด ${formatDrawDate(syncNotice.latest)}`}
          </span>
        </div>
      )}

      {!syncNotice && status === "up-to-date" && (
        <div className="meta meta-status meta-ok">
          <b>ตามต้นทาง</b>
        </div>
      )}

      {!syncNotice && showSourceHint && (
        <div className="meta meta-status meta-warn">
          <b>มีข้อมูลใหม่จากต้นทาง</b>
          <span>ต้นทาง {formatDrawDate(freshness.sourceLatestDrawDate!)}</span>
        </div>
      )}

      {!syncNotice && status === "source-unreachable" && (
        <div className="meta meta-status meta-muted">
          <span>ตรวจสอบต้นทางไม่ได้</span>
        </div>
      )}

      {!syncNotice &&
        status === "unknown" &&
        freshness?.sourceLatestDrawDate && (
          <div className="meta meta-status meta-muted">
            <span>
              ตรวจสอบต้นทางแล้ว · ล่าสุด{" "}
              {formatDrawDate(freshness.sourceLatestDrawDate)}
            </span>
          </div>
        )}
    </div>
  );
}

export function syncNeedsUpdate(
  freshness: FreshnessInfo | null,
  syncNotice: { addedDraws: number; latest: string } | null,
) {
  return !syncNotice && freshness?.status === "cache-behind";
}
