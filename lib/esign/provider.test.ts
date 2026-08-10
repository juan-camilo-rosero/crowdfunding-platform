import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getEsignProvider, resetEsignProvider } from "./provider";
import type { SigningSubject } from "./types";

const ENV_KEYS = ["ESIGN_PROVIDER", "ESIGN_PROVIDER_URL", "ESIGN_API_KEY"] as const;
const original: Record<string, string | undefined> = {};

const SUBJECT: SigningSubject = {
  userId: "user-1",
  investorId: "inv-1",
  documentName: "Contrato de inversión",
  signerEmail: "ana@ejemplo.com",
  signerName: "Ana Pérez",
};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    original[key] = process.env[key];
    delete process.env[key];
  }
  resetEsignProvider();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
  resetEsignProvider();
});

describe("provider selection", () => {
  it("defaults to the mock", () => {
    expect(getEsignProvider().name).toBe("mock");
  });

  it("uses Documenso only when it is named AND configured", () => {
    process.env.ESIGN_PROVIDER = "documenso";
    process.env.ESIGN_PROVIDER_URL = "https://esign.example";
    process.env.ESIGN_API_KEY = "k";
    resetEsignProvider();

    expect(getEsignProvider().name).toBe("documenso");
  });

  it("falls back to the mock when it is named without credentials", () => {
    process.env.ESIGN_PROVIDER = "documenso";
    resetEsignProvider();

    expect(getEsignProvider().name).toBe("mock");
  });
});

describe("the mock signs on the SERVER", () => {
  it("resolves as signed, with a placeholder file", async () => {
    const request = await getEsignProvider().createSigningRequest(SUBJECT);

    expect(request.status).toBe("signed");
    if (request.status !== "signed") return;
    expect(request.fileUrl).toMatch(/^data:text\/plain/);
    expect(request.signedAt).toBeTruthy();
  });

  it("needs no bucket, upload or cleanup to work", async () => {
    const request = await getEsignProvider().createSigningRequest(SUBJECT);
    if (request.status !== "signed") return;
    // A data: URL rather than a Storage object, so the mock has no
    // infrastructure of its own to fail on.
    expect(request.fileUrl.startsWith("data:")).toBe(true);
  });

  it("marks the envelope as coming from the mock", async () => {
    const request = await getEsignProvider().createSigningRequest(SUBJECT);
    if (request.status !== "signed") return;
    expect(request.envelopeId).toContain("mock-");
  });
});

describe("the Documenso slot", () => {
  it("reports that it is not implemented instead of pretending", async () => {
    process.env.ESIGN_PROVIDER = "documenso";
    process.env.ESIGN_PROVIDER_URL = "https://esign.example";
    process.env.ESIGN_API_KEY = "k";
    resetEsignProvider();

    const request = await getEsignProvider().createSigningRequest(SUBJECT);
    expect(request.status).toBe("failed");
  });
});
