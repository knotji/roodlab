import { afterEach, describe, expect, it } from "vitest";
import { guardWrite } from "./write-guard";

afterEach(() => {
  delete process.env.SYNC_SECRET;
});

describe("write guard", () => {
  it("accepts same-origin browser writes", async () => {
    const request = new Request("https://roodlab.test/api/history/demo", {
      method: "POST",
      headers: { origin: "https://roodlab.test" },
    });
    await expect(guardWrite(request, "same-origin", 1)).resolves.toEqual({ ok: true });
  });

  it("rejects cross-origin writes without a secret", async () => {
    const request = new Request("https://roodlab.test/api/catalog", {
      method: "POST",
      headers: { origin: "https://attacker.test" },
    });
    await expect(guardWrite(request, "cross-origin", 1)).resolves.toMatchObject({ ok: false, status: 403 });
  });

  it("accepts a matching server secret", async () => {
    process.env.SYNC_SECRET = "test-only-secret";
    const request = new Request("https://roodlab.test/api/catalog", {
      method: "POST",
      headers: { "x-sync-secret": "test-only-secret" },
    });
    await expect(guardWrite(request, "secret", 1)).resolves.toEqual({ ok: true });
  });

  it("rate limits repeated writes to the same resource", async () => {
    const request = new Request("https://roodlab.test/api/history/demo", {
      method: "POST",
      headers: { origin: "https://roodlab.test" },
    });
    await expect(guardWrite(request, "limited", 60)).resolves.toEqual({ ok: true });
    await expect(guardWrite(request, "limited", 60)).resolves.toMatchObject({ ok: false, status: 429 });
  });
});
