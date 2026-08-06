import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Converting a visitor into an investor is a high-impact admin action, so the
 * tests that cannot fail are: only an admin may do it, it never produces a
 * second link, and it changes NOTHING except the relationship — not role, not
 * capital, not a transaction.
 */

const TARGET_ID = "11111111-1111-4111-8111-111111111111";

const getUser = vi.fn();
const insert = vi.fn();
const update = vi.fn();
/** Every table touched, in order, so invariants can be asserted on it. */
const touched: string[] = [];
let tableData: Record<string, { data?: unknown; error?: unknown }> = {};
/** Per-table, per-call queue: `users` is read twice (caller, then target). */
let usersQueue: unknown[] = [];

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: (table: string) => {
      touched.push(table);
      const builder: Record<string, unknown> = {
        insert: (payload: unknown) => insert(table, payload),
        update: (payload: unknown) => {
          update(table, payload);
          return builder;
        },
      };
      for (const method of ["select", "eq", "is", "neq", "limit", "order"]) {
        builder[method] = () => builder;
      }
      const answer = () => {
        if (table === "users" && usersQueue.length > 0) {
          return { data: usersQueue.shift(), error: null };
        }
        return {
          data: tableData[table]?.data ?? null,
          error: tableData[table]?.error ?? null,
        };
      };
      builder.single = async () => answer();
      builder.maybeSingle = async () => answer();
      builder.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve(answer()).then(resolve);
      return builder;
    },
  }),
}));

const { convertVisitorToInvestor } = await import("./actions");

const TARGET = {
  id: TARGET_ID,
  full_name: "Ana Pérez",
  email: "ana@ejemplo.com",
  phone: "+573001112233",
  role: "visitante",
  onboarding_completed: true,
};

/**
 * @param callerRole   role of the admin making the request
 * @param target       the user being converted
 * @param existingLink rows already linking that user to an investor
 * @param unlinked     unlinked investor records, for the email match
 */
function scenario({
  callerRole = "admin",
  target = TARGET as Record<string, unknown> | null,
  existingLink = [] as unknown[],
  unlinked = [] as unknown[],
} = {}) {
  usersQueue = [{ role: callerRole }, target];
  tableData = { investors: { data: existingLink } };
  // The two investors reads happen in order: existing link, then unlinked list.
  let investorsCall = 0;
  tableData.investors = {
    get data() {
      investorsCall += 1;
      return investorsCall === 1 ? existingLink : unlinked;
    },
  } as { data?: unknown };
}

beforeEach(() => {
  vi.clearAllMocks();
  touched.length = 0;
  getUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
  insert.mockResolvedValue({ error: null });
  update.mockReturnValue(undefined);
  scenario();
});

describe("authorisation", () => {
  it("REJECTS a non-admin caller", async () => {
    scenario({ callerRole: "visitante" });

    const result = await convertVisitorToInvestor({ userId: TARGET_ID });

    expect(result.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("REJECTS a caller with no session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const result = await convertVisitorToInvestor({ userId: TARGET_ID });

    expect(result.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects a malformed id before touching anything", async () => {
    const result = await convertVisitorToInvestor({ userId: "not-a-uuid" });

    expect(result.ok).toBe(false);
    expect(touched).toEqual([]);
  });
});

describe("who can be converted", () => {
  it("refuses an admin as the target", async () => {
    scenario({ target: { ...TARGET, role: "admin" } });

    const result = await convertVisitorToInvestor({ userId: TARGET_ID });

    expect(result.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it("refuses someone who has not completed onboarding", async () => {
    scenario({ target: { ...TARGET, onboarding_completed: false } });

    const result = await convertVisitorToInvestor({ userId: TARGET_ID });

    expect(result.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it("refuses an unknown user", async () => {
    scenario({ target: null });

    const result = await convertVisitorToInvestor({ userId: TARGET_ID });

    expect(result.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it("is idempotent: converting someone already linked is a no-op", async () => {
    scenario({ existingLink: [{ id: "inv-existing" }] });

    const result = await convertVisitorToInvestor({ userId: TARGET_ID });

    expect(result.ok).toBe(false);
    // No second identity for one person.
    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});

describe("connect vs create", () => {
  it("CONNECTS an unlinked record whose email matches", async () => {
    scenario({
      unlinked: [{ id: "inv-prospect", email: "ana@ejemplo.com", user_id: null }],
    });

    const result = await convertVisitorToInvestor({ userId: TARGET_ID });

    expect(result).toEqual({ ok: true, outcome: "connected" });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][1].user_id).toBe(TARGET_ID);
    // No duplicate record.
    expect(insert).not.toHaveBeenCalled();
  });

  it("matches the email case-insensitively", async () => {
    scenario({
      unlinked: [{ id: "inv-prospect", email: "ANA@Ejemplo.com", user_id: null }],
    });

    const result = await convertVisitorToInvestor({ userId: TARGET_ID });

    expect(result).toEqual({ ok: true, outcome: "connected" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("CREATES a record when no email matches", async () => {
    scenario({
      unlinked: [{ id: "inv-other", email: "otro@ejemplo.com", user_id: null }],
    });

    const result = await convertVisitorToInvestor({ userId: TARGET_ID });

    expect(result).toEqual({ ok: true, outcome: "created" });
    expect(update).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("seeds the new record from the profile, as a prospect", async () => {
    await convertVisitorToInvestor({ userId: TARGET_ID });

    const [table, payload] = insert.mock.calls[0];
    expect(table).toBe("investors");
    expect(payload).toMatchObject({
      user_id: TARGET_ID,
      full_name: "Ana Pérez",
      email: "ana@ejemplo.com",
      phone: "+573001112233",
      status: "prospecto",
      pipeline_stage: "contacto",
    });
  });

  it("falls back to the email when the profile has no name", async () => {
    scenario({ target: { ...TARGET, full_name: null } });

    await convertVisitorToInvestor({ userId: TARGET_ID });

    // investors.full_name is NOT NULL; a blocked conversion would be worse.
    expect(insert.mock.calls[0][1].full_name).toBe("ana@ejemplo.com");
  });
});

describe("invariants", () => {
  it("NEVER writes to users: role and status are untouched", async () => {
    await convertVisitorToInvestor({ userId: TARGET_ID });

    // `users` is read twice (caller, target) but never written.
    expect(insert.mock.calls.every(([table]) => table !== "users")).toBe(true);
    expect(update.mock.calls.every(([table]) => table !== "users")).toBe(true);
  });

  it("NEVER writes capital or transactions", async () => {
    await convertVisitorToInvestor({ userId: TARGET_ID });

    // Converting is a relationship, not an investment.
    expect(touched).not.toContain("transactions");
    expect(touched).not.toContain("capital_contributions");
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).toBe("investors");
  });

  it("reports a write failure without claiming success", async () => {
    insert.mockResolvedValue({ error: { message: "denied by RLS" } });

    const result = await convertVisitorToInvestor({ userId: TARGET_ID });

    expect(result.ok).toBe(false);
  });
});
