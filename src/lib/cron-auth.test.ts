import { afterEach, describe, expect, it } from "vitest";
import { cronAuthorizationStatus } from "./cron-auth";

const previousSecret = process.env.CRON_SECRET;

afterEach(() => {
  if (previousSecret) process.env.CRON_SECRET = previousSecret;
  else delete process.env.CRON_SECRET;
});

describe("cron authorization", () => {
  it("fails closed when the secret is missing", () => {
    delete process.env.CRON_SECRET;
    expect(cronAuthorizationStatus(null)).toBe("missing-secret");
  });

  it("requires the exact bearer token", () => {
    process.env.CRON_SECRET = "expected-secret-value";
    expect(cronAuthorizationStatus("Bearer wrong")).toBe("unauthorized");
    expect(cronAuthorizationStatus("Bearer expected-secret-value")).toBe("authorized");
  });
});

