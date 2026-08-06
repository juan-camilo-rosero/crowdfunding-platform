import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The tests that cannot fail: the mutation must derive the investor from the
 * session, enforce the amount ceiling with ITS OWN number, force
 * status = 'pendiente', and never touch `transactions`.
 */

const UUID_FROM = "11111111-1111-4111-8111-111111111111";
const UUID_TO = "22222222-2222-4222-8222-222222222222";
const UUID_OTHER = "33333333-3333-4333-8333-333333333333";

const getUser = vi.fn();
const insert = vi.fn();
/** Every table the action touched, in order. */
const touched: string[] = [];
/** Per-table canned responses. */
let tableData: Record<string, { data?: unknown[]; error?: unknown }> = {};

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: (table: string) => {
      touched.push(table);
      const builder: Record<string, unknown> = { insert: (payload: unknown) => insert(table, payload) };
      for (const method of ["select", "eq", "in", "not", "gt"]) {
        builder[method] = () => builder;
      }
      builder.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve({
          data: tableData[table]?.data ?? [],
          error: tableData[table]?.error ?? null,
        }).then(resolve);
      return builder;
    },
  }),
}));

const { createReassignmentRequest } = await import("./actions");

const VALID = { fromProjectId: UUID_FROM, toProjectId: UUID_TO, amount: 1000 };

/** Investor A holds 10.000 in the source; the destination is eligible. */
function baseline({ pending = [] as unknown[] } = {}) {
  tableData = {
    investors: { data: [{ id: "inv-a" }] },
    investor_project_position: {
      data: [{ project_id: UUID_FROM, current_capital: "10000" }],
    },
    reassignment_requests: { data: pending },
    projects: {
      data: [
        { id: UUID_FROM, name: "Origen" },
        { id: UUID_TO, name: "Destino" },
      ],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  touched.length = 0;
  getUser.mockResolvedValue({ data: { user: { id: "user-a" } } });
  insert.mockResolvedValue({ error: null });
  baseline();
});

describe("identity is derived, never accepted", () => {
  it("looks the investor up from the session, not the payload", async () => {
    await createReassignmentRequest(VALID);

    expect(getUser).toHaveBeenCalled();
    expect(touched[0]).toBe("investors");
    const [, payload] = insert.mock.calls[0];
    expect(payload.investor_id).toBe("inv-a");
  });

  it("IGNORES an investor_id smuggled in the payload", async () => {
    await createReassignmentRequest({
      ...VALID,
      investor_id: "investor-of-somebody-else",
    });

    const [, payload] = insert.mock.calls[0];
    expect(payload.investor_id).toBe("inv-a");
    expect(payload.investor_id).not.toBe("investor-of-somebody-else");
  });

  it("refuses a caller with no session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const result = await createReassignmentRequest(VALID);

    expect(result.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it("refuses a user with no investor link", async () => {
    tableData.investors = { data: [] };

    const result = await createReassignmentRequest(VALID);

    expect(result.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("the amount ceiling is enforced by the SERVER", () => {
  it("accepts an amount within the real availability", async () => {
    const result = await createReassignmentRequest({ ...VALID, amount: 9999 });

    expect(result.ok).toBe(true);
    expect(insert).toHaveBeenCalled();
  });

  it("accepts exactly the available amount", async () => {
    const result = await createReassignmentRequest({ ...VALID, amount: 10000 });
    expect(result.ok).toBe(true);
  });

  it("rejects an amount above it, whatever the client believed", async () => {
    const result = await createReassignmentRequest({ ...VALID, amount: 10001 });

    expect(result.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it("counts pending requests against the ceiling", async () => {
    // 10.000 held, 4.000 already claimed by a pending request → 6.000 left.
    baseline({ pending: [{ from_project_id: UUID_FROM, amount: "4000" }] });

    const overshoot = await createReassignmentRequest({ ...VALID, amount: 6001 });
    expect(overshoot.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();

    const fits = await createReassignmentRequest({ ...VALID, amount: 6000 });
    expect(fits.ok).toBe(true);
  });

  it("rejects a source the investor holds nothing in", async () => {
    const result = await createReassignmentRequest({
      ...VALID,
      fromProjectId: UUID_OTHER,
    });

    expect(result.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it("does not write when availability cannot be read", async () => {
    tableData.investor_project_position = { error: { message: "down" } };

    const result = await createReassignmentRequest(VALID);

    expect(result.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("origin and destination rules are re-checked", () => {
  it("rejects origin equal to destination", async () => {
    const result = await createReassignmentRequest({
      ...VALID,
      toProjectId: UUID_FROM,
    });

    expect(result.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects a destination that is not eligible", async () => {
    // The destinations query returns only the source project.
    tableData.projects = { data: [{ id: UUID_FROM, name: "Origen" }] };

    const result = await createReassignmentRequest(VALID);

    expect(result.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects a malformed payload before touching anything", async () => {
    const result = await createReassignmentRequest({
      fromProjectId: "not-a-uuid",
      toProjectId: UUID_TO,
      amount: 100,
    });

    expect(result.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("what gets written", () => {
  it("forces status to 'pendiente'", async () => {
    await createReassignmentRequest(VALID);

    const [, payload] = insert.mock.calls[0];
    expect(payload.status).toBe("pendiente");
  });

  it("IGNORES a status smuggled in the payload: no request is born approved", async () => {
    await createReassignmentRequest({ ...VALID, status: "aprobada" });

    const [, payload] = insert.mock.calls[0];
    expect(payload.status).toBe("pendiente");
  });

  it("never writes resolved_at or resolved_by", async () => {
    await createReassignmentRequest({
      ...VALID,
      resolved_at: "2026-01-01",
      resolved_by: "user-a",
    });

    const [, payload] = insert.mock.calls[0];
    expect(payload).not.toHaveProperty("resolved_at");
    expect(payload).not.toHaveProperty("resolved_by");
  });

  it("writes to reassignment_requests and NOTHING to transactions", async () => {
    await createReassignmentRequest(VALID);

    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).toBe("reassignment_requests");
    // Creating a request never moves money; only an approval does.
    expect(touched).not.toContain("transactions");
  });

  it("reports a save failure without claiming success", async () => {
    insert.mockResolvedValue({ error: { message: "denied by RLS" } });

    const result = await createReassignmentRequest(VALID);

    expect(result.ok).toBe(false);
  });
});
