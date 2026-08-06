import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getEmailProvider, resetEmailProvider, sendTransactionalEmail } from "./provider";

/**
 * Provider selection is the mechanism that makes email OPTIONAL, so it is worth
 * pinning: no configuration must degrade to a no-op, never to an error.
 */

const ENV_KEYS = [
  "EMAIL_PROVIDER",
  "RESEND_API_KEY",
  "EMAIL_FROM",
] as const;

const saved: Record<string, string | undefined> = {};

function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const key of ENV_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(values)) process.env[key] = value;
  resetEmailProvider();
}

beforeEach(() => {
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key]!;
  }
  resetEmailProvider();
  vi.restoreAllMocks();
});

describe("provider selection", () => {
  it("falls back to a no-op with nothing configured", () => {
    setEnv({});
    expect(getEmailProvider().name).toBe("noop");
  });

  it("uses Resend when a key and a sender are present", () => {
    setEnv({ RESEND_API_KEY: "re_test", EMAIL_FROM: "Investors <no-reply@x.co>" });
    expect(getEmailProvider().name).toBe("resend");
  });

  it("still sends with only a key, falling back to the sandbox sender", () => {
    // Requiring EMAIL_FROM used to disable mail entirely for a deployment that
    // had set nothing but the key — the least useful default available.
    setEnv({ RESEND_API_KEY: "re_test" });
    expect(getEmailProvider().name).toBe("resend");
  });

  it("honours an explicit opt-out even with credentials present", () => {
    setEnv({
      EMAIL_PROVIDER: "none",
      RESEND_API_KEY: "re_test",
      EMAIL_FROM: "a@b.co",
    });
    expect(getEmailProvider().name).toBe("noop");
  });

  it("degrades to a no-op when a provider is named but has no key", () => {
    setEnv({ EMAIL_PROVIDER: "resend" });
    expect(getEmailProvider().name).toBe("noop");
  });
});

describe("sending never throws", () => {
  it("reports 'skipped' instead of failing when unconfigured", async () => {
    setEnv({});

    const result = await sendTransactionalEmail({
      to: "team@ejemplo.com",
      subject: "Nuevo interés",
      text: "cuerpo",
    });

    expect(result.status).toBe("skipped");
  });

  it("turns a provider failure into a result, not an exception", async () => {
    setEnv({ RESEND_API_KEY: "re_test", EMAIL_FROM: "a@b.co" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down"))
    );

    const result = await sendTransactionalEmail({
      to: "team@ejemplo.com",
      subject: "Nuevo interés",
      text: "cuerpo",
    });

    // The caller gets a value it can ignore, never a throw it must catch.
    expect(result.status).toBe("failed");
    vi.unstubAllGlobals();
  });

  it("reports a non-2xx response as failed rather than sent", async () => {
    setEnv({ RESEND_API_KEY: "re_test", EMAIL_FROM: "a@b.co" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        text: async () => "invalid sender",
      })
    );

    const result = await sendTransactionalEmail({
      to: "team@ejemplo.com",
      subject: "s",
      text: "t",
    });

    expect(result.status).toBe("failed");
    vi.unstubAllGlobals();
  });
});
