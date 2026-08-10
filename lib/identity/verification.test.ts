import { beforeEach, describe, expect, it, vi } from "vitest";

type Op = { table: string; method: string; payload: unknown; filters: unknown[] };

const ops: Op[] = [];
let insertError: { message: string } | null = null;
let updateError: { message: string } | null = null;

const createAdminClient = vi.fn(() => ({
  from: (table: string) => ({
    insert: (payload: unknown) => {
      ops.push({ table, method: "insert", payload, filters: [] });
      return Promise.resolve({ error: insertError });
    },
    update: (payload: unknown) => {
      const filters: unknown[] = [];
      const builder = {
        eq: (column: string, value: unknown) => {
          filters.push([column, value]);
          ops.push({ table, method: "update", payload, filters });
          return Promise.resolve({ error: updateError });
        },
      };
      return builder;
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => createAdminClient() }));

const startVerification = vi.fn();
vi.mock("./provider", () => ({
  getIdentityProvider: () => ({ name: "mock", startVerification }),
}));

const { recordVerificationOutcome, startIdentityVerification } = await import(
  "./verification"
);

const inserted = (table: string) =>
  ops.filter((op) => op.table === table && op.method === "insert").map((op) => op.payload);

beforeEach(() => {
  vi.clearAllMocks();
  ops.length = 0;
  insertError = null;
  updateError = null;
  startVerification.mockResolvedValue({
    status: "resolved",
    processId: "mock-1",
    outcome: { status: "aprobado" },
  });
});

describe("an approval", () => {
  it("records the attempt and flips users.identity_verified", async () => {
    const result = await recordVerificationOutcome({
      userId: "user-1",
      processId: "mock-1",
      outcome: { status: "aprobado" },
    });

    expect(result).toEqual({
      ok: true,
      record: { status: "aprobado", declineReason: null },
    });

    expect(inserted("identity_verifications")[0]).toMatchObject({
      user_id: "user-1",
      truora_process_id: "mock-1",
      status: "aprobado",
      decline_reason: null,
    });

    const update = ops.find((op) => op.table === "users" && op.method === "update");
    expect(update!.payload).toMatchObject({ identity_verified: true });
    // Scoped to the one user, never a blanket update.
    expect(update!.filters).toEqual([["id", "user-1"]]);
  });
});

describe("a rejection", () => {
  it("records the reason and does NOT touch the flag", async () => {
    const result = await recordVerificationOutcome({
      userId: "user-1",
      processId: "mock-1",
      outcome: { status: "rechazado", declineReason: "documento ilegible" },
    });

    expect(result).toEqual({
      ok: true,
      record: { status: "rechazado", declineReason: "documento ilegible" },
    });
    expect(inserted("identity_verifications")[0]).toMatchObject({
      status: "rechazado",
      decline_reason: "documento ilegible",
    });
    // The only thing that may set the flag is an approval.
    expect(ops.some((op) => op.table === "users")).toBe(false);
  });

  it("leaves the flag alone on an expiry too", async () => {
    await recordVerificationOutcome({
      userId: "user-1",
      processId: "mock-1",
      outcome: { status: "expirado", declineReason: "expiró" },
    });

    expect(ops.some((op) => op.table === "users")).toBe(false);
  });

  it("lets a retry add a NEW row instead of editing the old one", async () => {
    await recordVerificationOutcome({
      userId: "user-1",
      processId: "p1",
      outcome: { status: "rechazado", declineReason: "primera" },
    });
    await recordVerificationOutcome({
      userId: "user-1",
      processId: "p2",
      outcome: { status: "aprobado" },
    });

    // The table is the audit trail: overwriting would erase the rejection.
    expect(inserted("identity_verifications")).toHaveLength(2);
    expect(ops.filter((op) => op.method === "update")).toHaveLength(1);
  });
});

describe("failures never escape as throws", () => {
  it("reports a failed insert", async () => {
    insertError = { message: "insert down" };

    expect(
      await recordVerificationOutcome({
        userId: "user-1",
        processId: "p",
        outcome: { status: "aprobado" },
      })
    ).toEqual({ ok: false, reason: "insert down" });
  });

  it("reports a failed flag update, so nothing claims success", async () => {
    updateError = { message: "update down" };

    const result = await recordVerificationOutcome({
      userId: "user-1",
      processId: "p",
      outcome: { status: "aprobado" },
    });

    expect(result.ok).toBe(false);
  });

  it("survives the admin client throwing", async () => {
    createAdminClient.mockImplementationOnce(() => {
      throw new Error("no service role key");
    });

    const result = await recordVerificationOutcome({
      userId: "user-1",
      processId: "p",
      outcome: { status: "aprobado" },
    });

    expect(result).toEqual({ ok: false, reason: "no service role key" });
  });
});

describe("starting a verification", () => {
  it("passes the user id it was given to the provider", async () => {
    await startIdentityVerification("user-1");
    expect(startVerification).toHaveBeenCalledWith("user-1");
  });

  it("persists whatever the provider resolved", async () => {
    startVerification.mockResolvedValue({
      status: "resolved",
      processId: "mock-9",
      outcome: { status: "rechazado", declineReason: "simulado" },
    });

    const attempt = await startIdentityVerification("user-1");

    expect(attempt).toEqual({
      ok: true,
      kind: "resolved",
      record: { status: "rechazado", declineReason: "simulado" },
    });
  });

  it("records an 'iniciado' breadcrumb and redirects for a real provider", async () => {
    startVerification.mockResolvedValue({
      status: "pending",
      processId: "truora-1",
      redirectUrl: "https://identity.example/flow",
    });

    const attempt = await startIdentityVerification("user-1");

    expect(attempt).toEqual({
      ok: true,
      kind: "pending",
      redirectUrl: "https://identity.example/flow",
    });
    expect(inserted("identity_verifications")[0]).toMatchObject({ status: "iniciado" });
    // Nobody is verified yet: the webhook decides that later.
    expect(ops.some((op) => op.table === "users")).toBe(false);
  });

  it("reports a provider failure without touching anything", async () => {
    startVerification.mockResolvedValue({ status: "failed", reason: "vendor down" });

    expect(await startIdentityVerification("user-1")).toEqual({
      ok: false,
      reason: "vendor down",
    });
    expect(ops).toEqual([]);
  });
});
