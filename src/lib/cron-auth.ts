export function cronAuthorizationStatus(
  authorization: string | null,
): "missing-secret" | "unauthorized" | "authorized" {
  const secret = process.env.CRON_SECRET;
  if (!secret) return "missing-secret";
  return authorization === `Bearer ${secret}` ? "authorized" : "unauthorized";
}

