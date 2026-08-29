import { timingSafeEqual } from "node:crypto";
import { hasDatabase } from "./database";
import { claimPostgresWrite } from "./postgres-storage";

const localLimits = new Map<string, number>();

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === new URL(request.url).host;
    } catch {
      return false;
    }
  }
  return request.headers.get("sec-fetch-site") === "same-origin";
}

function validSecret(request: Request): boolean {
  const expected = process.env.SYNC_SECRET;
  if (!expected) return false;
  const supplied =
    request.headers.get("x-sync-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!supplied) return false;
  const actualBuffer = Buffer.from(supplied), expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

async function claimWrite(key: string, cooldownSeconds: number): Promise<boolean> {
  if (hasDatabase()) return claimPostgresWrite(key, cooldownSeconds);
  const now = Date.now(), availableAt = localLimits.get(key) ?? 0;
  if (availableAt > now) return false;
  localLimits.set(key, now + cooldownSeconds * 1000);
  return true;
}

export async function guardWrite(
  request: Request,
  key: string,
  cooldownSeconds: number,
): Promise<{ ok: true } | { ok: false; status: 403 | 429; error: string }> {
  if (!sameOrigin(request) && !validSecret(request)) {
    return { ok: false, status: 403, error: "คำขอเขียนข้อมูลไม่ได้รับอนุญาต" };
  }
  if (!(await claimWrite(key, cooldownSeconds))) {
    return { ok: false, status: 429, error: "เพิ่งอัปเดตไป กรุณารอสักครู่แล้วลองใหม่" };
  }
  return { ok: true };
}

