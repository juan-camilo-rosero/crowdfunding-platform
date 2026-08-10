import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getIdentityProvider, resetIdentityProvider } from "./provider";

const ENV_KEYS = [
  "IDENTITY_PROVIDER",
  "IDENTITY_MOCK_OUTCOME",
  "TRUORA_API_KEY",
  "TRUORA_ACCOUNT_ID",
] as const;

const original: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    original[key] = process.env[key];
    delete process.env[key];
  }
  resetIdentityProvider();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
  resetIdentityProvider();
});

describe("provider selection", () => {
  it("defaults to the mock", () => {
    expect(getIdentityProvider().name).toBe("mock");
  });

  it("uses Truora only when it is named AND configured", () => {
    process.env.IDENTITY_PROVIDER = "truora";
    process.env.TRUORA_API_KEY = "k";
    process.env.TRUORA_ACCOUNT_ID = "acct";
    resetIdentityProvider();

    expect(getIdentityProvider().name).toBe("truora");
  });

  it("falls back to the mock when Truora is named without credentials", () => {
    // integrations.md: the module can stay off by configuration.
    process.env.IDENTITY_PROVIDER = "truora";
    resetIdentityProvider();

    expect(getIdentityProvider().name).toBe("mock");
  });

  it("re-resolves when the env changes, without a restart", () => {
    expect(getIdentityProvider().name).toBe("mock");

    process.env.IDENTITY_PROVIDER = "truora";
    process.env.TRUORA_API_KEY = "k";
    process.env.TRUORA_ACCOUNT_ID = "acct";
    expect(getIdentityProvider().name).toBe("truora");
  });
});

describe("the mock decides on the SERVER", () => {
  it("approves by default", async () => {
    const started = await getIdentityProvider().startVerification("user-1");

    expect(started.status).toBe("resolved");
    if (started.status !== "resolved") return;
    expect(started.outcome.status).toBe("aprobado");
  });

  it("rejects when the environment says so, for testing the unhappy path", async () => {
    process.env.IDENTITY_MOCK_OUTCOME = "rechazado";
    resetIdentityProvider();

    const started = await getIdentityProvider().startVerification("user-1");

    expect(started.status).toBe("resolved");
    if (started.status !== "resolved") return;
    expect(started.outcome.status).toBe("rechazado");
    // A reason is always given, so the UI never shows a blank refusal.
    expect("declineReason" in started.outcome && started.outcome.declineReason).toBeTruthy();
  });

  it("can simulate an expiry too", async () => {
    process.env.IDENTITY_MOCK_OUTCOME = "expirado";
    resetIdentityProvider();

    const started = await getIdentityProvider().startVerification("user-1");
    if (started.status !== "resolved") return;
    expect(started.outcome.status).toBe("expirado");
  });

  it("ignores an unknown value rather than failing shut", async () => {
    process.env.IDENTITY_MOCK_OUTCOME = "quizás";
    resetIdentityProvider();

    const started = await getIdentityProvider().startVerification("user-1");
    if (started.status !== "resolved") return;
    expect(started.outcome.status).toBe("aprobado");
  });

  it("takes NOTHING from the caller but the user id", async () => {
    const started = await getIdentityProvider().startVerification("user-1");

    // The outcome is a function of the environment alone: there is no argument
    // through which a request could ask to be approved.
    expect(started.status).toBe("resolved");
    if (started.status !== "resolved") return;
    expect(started.processId).toContain("user-1");
  });
});

describe("the Truora slot", () => {
  it("reports that it is not implemented instead of pretending", async () => {
    process.env.IDENTITY_PROVIDER = "truora";
    process.env.TRUORA_API_KEY = "k";
    process.env.TRUORA_ACCOUNT_ID = "acct";
    resetIdentityProvider();

    const started = await getIdentityProvider().startVerification("user-1");

    expect(started.status).toBe("failed");
  });
});
