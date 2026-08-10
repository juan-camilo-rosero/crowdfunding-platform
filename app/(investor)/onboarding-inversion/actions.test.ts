import { beforeEach, describe, expect, it, vi } from "vitest";
import { es } from "@/i18n";

const getCurrentUser = vi.fn();
const getInvestorIds = vi.fn();
const getCurrentUserProfile = vi.fn();
const startIdentityVerification = vi.fn();
const requestContractSignature = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: () => getCurrentUser(),
  getInvestorIds: () => getInvestorIds(),
  getCurrentUserProfile: () => getCurrentUserProfile(),
}));
vi.mock("@/lib/identity/verification", () => ({
  startIdentityVerification: (userId: string) => startIdentityVerification(userId),
}));
vi.mock("@/lib/esign/contract", () => ({
  CONTRACT_DOC_TYPE: "contrato",
  requestContractSignature: (subject: unknown) => requestContractSignature(subject),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { signContract, verifyIdentity } = await import("./actions");

const ENV_KEYS = [
  "INVESTMENT_ONBOARDING_ENABLED",
  "IDENTITY_VERIFICATION_ENABLED",
  "CONTRACT_SIGNING_ENABLED",
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of ENV_KEYS) delete process.env[key];

  getCurrentUser.mockResolvedValue({ id: "user-1", email: "ana@ejemplo.com" });
  getInvestorIds.mockResolvedValue(["inv-1"]);
  getCurrentUserProfile.mockResolvedValue({
    id: "user-1",
    email: "ana@ejemplo.com",
    full_name: "Ana Pérez",
    identity_verified: true,
  });
  startIdentityVerification.mockResolvedValue({
    ok: true,
    kind: "resolved",
    record: { status: "aprobado", declineReason: null },
  });
  requestContractSignature.mockResolvedValue({
    ok: true,
    kind: "signed",
    documentId: "doc-1",
  });
});

/**
 * The security shape of this feature, stated as a test: the actions take NO
 * arguments. There is no parameter through which a client could name a user,
 * an investor, or an outcome.
 */
describe("the client cannot state a result", () => {
  it("verifyIdentity accepts no arguments at all", () => {
    expect(verifyIdentity.length).toBe(0);
  });

  it("signContract accepts no arguments at all", () => {
    expect(signContract.length).toBe(0);
  });

  it("ignores anything passed anyway, and uses the session's user", async () => {
    // A hand-rolled call cannot smuggle an identity in.
    await (verifyIdentity as unknown as (input: unknown) => Promise<unknown>)({
      userId: "someone-else",
      status: "aprobado",
    });

    expect(startIdentityVerification).toHaveBeenCalledWith("user-1");
  });

  it("signs for the investor of the SESSION, never one that was passed", async () => {
    await (signContract as unknown as (input: unknown) => Promise<unknown>)({
      investorId: "inv-999",
    });

    expect(requestContractSignature).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", investorId: "inv-1" })
    );
  });

  it("reports only what the SERVER decided, not what was asked for", async () => {
    startIdentityVerification.mockResolvedValue({
      ok: true,
      kind: "resolved",
      record: { status: "rechazado", declineReason: "simulado" },
    });

    const result = await verifyIdentity();

    // Asking to be approved does not approve anybody.
    expect(result).toEqual({
      ok: true,
      status: "rechazado",
      message: es.investmentOnboarding.identity.rejected,
    });
  });
});

describe("eligibility", () => {
  it("refuses someone with no session", async () => {
    getCurrentUser.mockResolvedValue(null);

    expect(await verifyIdentity()).toEqual({
      ok: false,
      error: es.investmentOnboarding.errors.notInvestor,
    });
    expect(startIdentityVerification).not.toHaveBeenCalled();
  });

  it("refuses someone with no investor link", async () => {
    // Nobody self-enrols: the link is the admin's act (user-management.md).
    getInvestorIds.mockResolvedValue([]);

    expect(await verifyIdentity()).toEqual({
      ok: false,
      error: es.investmentOnboarding.errors.notInvestor,
    });
    expect(await signContract()).toEqual({
      ok: false,
      error: es.investmentOnboarding.errors.notInvestor,
    });
    expect(requestContractSignature).not.toHaveBeenCalled();
  });
});

describe("the configuration flags are enforced on the server", () => {
  it("refuses identity when the whole flow is off", async () => {
    process.env.INVESTMENT_ONBOARDING_ENABLED = "false";

    expect(await verifyIdentity()).toEqual({
      ok: false,
      error: es.investmentOnboarding.errors.disabled,
    });
    expect(startIdentityVerification).not.toHaveBeenCalled();
  });

  it("refuses identity when only that step is off", async () => {
    process.env.IDENTITY_VERIFICATION_ENABLED = "false";

    expect(await verifyIdentity()).toEqual({
      ok: false,
      error: es.investmentOnboarding.errors.disabled,
    });
  });

  it("refuses the signature when that step is off", async () => {
    process.env.CONTRACT_SIGNING_ENABLED = "false";

    expect(await signContract()).toEqual({
      ok: false,
      error: es.investmentOnboarding.errors.disabled,
    });
    expect(requestContractSignature).not.toHaveBeenCalled();
  });

  it("still allows the signature when only identity is skipped", async () => {
    process.env.IDENTITY_VERIFICATION_ENABLED = "false";
    getCurrentUserProfile.mockResolvedValue({ identity_verified: false });

    // With verification switched off it cannot be a prerequisite.
    expect(await signContract()).toEqual({ ok: true, status: "hecho" });
  });
});

describe("order of the steps", () => {
  it("refuses to sign before the identity is verified", async () => {
    getCurrentUserProfile.mockResolvedValue({ identity_verified: false });

    expect(await signContract()).toEqual({
      ok: false,
      error: es.investmentOnboarding.contract.blocked,
    });
    // Signing as somebody whose identity was never checked is the case the
    // verification exists to prevent.
    expect(requestContractSignature).not.toHaveBeenCalled();
  });
});

describe("what comes back", () => {
  it("reports success after an approval", async () => {
    expect(await verifyIdentity()).toEqual({ ok: true, status: "hecho" });
  });

  it("passes a real provider's redirect through instead of inventing a result", async () => {
    startIdentityVerification.mockResolvedValue({
      ok: true,
      kind: "pending",
      redirectUrl: "https://identity.example/flow",
    });

    expect(await verifyIdentity()).toEqual({
      ok: true,
      status: "pendiente",
      redirectUrl: "https://identity.example/flow",
    });
  });

  it("gives a Spanish message when the provider fails", async () => {
    startIdentityVerification.mockResolvedValue({ ok: false, reason: "boom" });

    const result = await verifyIdentity();

    expect(result).toEqual({
      ok: false,
      error: es.investmentOnboarding.errors.identityFailed,
    });
    // The internal reason stays in the logs.
    expect(JSON.stringify(result)).not.toContain("boom");
  });

  it("treats an already-signed contract as success, not an error", async () => {
    requestContractSignature.mockResolvedValue({
      ok: true,
      kind: "already-signed",
      documentId: "doc-1",
    });

    expect(await signContract()).toEqual({ ok: true, status: "hecho" });
  });
});
