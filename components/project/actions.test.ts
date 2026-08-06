import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The tests that cannot fail here:
 *  · user_id comes from the session, never from the payload;
 *  · status is forced to 'nuevo';
 *  · AND A MAIL FAILURE NEVER BREAKS THE SAVE. Email is a courtesy laid on top
 *    of the row; if it were allowed to fail the request, a team without a mail
 *    provider would have a broken interest form.
 */

const UUID_PROJECT = "11111111-1111-4111-8111-111111111111";

const getUser = vi.fn();
const insert = vi.fn();
const notifyTeamOfInterest = vi.fn();
const confirmInterestToUser = vi.fn();
const touched: string[] = [];
let tableData: Record<string, { data?: unknown; error?: unknown }> = {};

vi.mock("@/lib/interests/notify", () => ({
  notifyTeamOfInterest: (n: unknown) => notifyTeamOfInterest(n),
  confirmInterestToUser: (n: unknown) => confirmInterestToUser(n),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: (table: string) => {
      touched.push(table);
      const builder: Record<string, unknown> = {
        insert: (payload: unknown) => insert(table, payload),
      };
      for (const method of ["select", "eq", "order"]) {
        builder[method] = () => builder;
      }
      const answer = () => ({
        data: tableData[table]?.data ?? null,
        error: tableData[table]?.error ?? null,
      });
      builder.single = async () => answer();
      builder.maybeSingle = async () => answer();
      builder.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve(answer()).then(resolve);
      return builder;
    },
  }),
}));

const { createInvestmentInterest } = await import("./actions");

const VALID = {
  projectId: UUID_PROJECT,
  amount: 50000,
  investmentTypePref: "equity",
  comments: "Quiero saber más",
};

function baseline({
  profilePhone = "+573001112233",
}: { profilePhone?: string | null } = {}) {
  tableData = {
    users: {
      data: {
        full_name: "Ana Pérez",
        email: "ana@ejemplo.com",
        phone: profilePhone,
      },
    },
    projects: { data: { name: "Villa Rotonda 118" } },
    investment_interests: {},
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  touched.length = 0;
  getUser.mockResolvedValue({ data: { user: { id: "user-a", email: "ana@ejemplo.com" } } });
  insert.mockResolvedValue({ error: null });
  notifyTeamOfInterest.mockResolvedValue(undefined);
  confirmInterestToUser.mockResolvedValue(undefined);
  baseline();
});

describe("identity and status", () => {
  it("takes user_id from the session, not the payload", async () => {
    await createInvestmentInterest({ ...VALID, user_id: "somebody-else" });

    const [, payload] = insert.mock.calls[0];
    expect(payload.user_id).toBe("user-a");
    expect(payload.user_id).not.toBe("somebody-else");
  });

  it("forces status to 'nuevo' and ignores one in the payload", async () => {
    await createInvestmentInterest({ ...VALID, status: "cerrado" });

    const [, payload] = insert.mock.calls[0];
    expect(payload.status).toBe("nuevo");
  });

  it("refuses a caller with no session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const result = await createInvestmentInterest(VALID);

    expect(result.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it("writes to investment_interests and nowhere else", async () => {
    await createInvestmentInterest(VALID);

    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).toBe("investment_interests");
  });
});

describe("validation on the server", () => {
  it("rejects an amount at or below zero", async () => {
    const result = await createInvestmentInterest({ ...VALID, amount: 0 });

    expect(result.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects a type outside the stored enum", async () => {
    const result = await createInvestmentInterest({
      ...VALID,
      investmentTypePref: "cripto",
    });

    expect(result.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it("accepts an interest with no amount: a figure is optional", async () => {
    const result = await createInvestmentInterest({ ...VALID, amount: null });

    expect(result.ok).toBe(true);
    expect(insert.mock.calls[0][1].amount).toBeNull();
  });

  it("never asks for a phone: it attaches the one from the profile", async () => {
    const result = await createInvestmentInterest(VALID);

    expect(result.ok).toBe(true);
    // The onboarding already collected it; the team still gets a way to call.
    expect(insert.mock.calls[0][1].phone).toBe("+573001112233");
  });

  it("saves without a phone when the profile has none, rather than blocking", async () => {
    baseline({ profilePhone: null });

    const result = await createInvestmentInterest(VALID);

    expect(result.ok).toBe(true);
    expect(insert.mock.calls[0][1].phone).toBeNull();
  });

  it("IGNORES a phone smuggled in the payload", async () => {
    await createInvestmentInterest({ ...VALID, phone: "9999999999" });

    // Only the profile's number is ever written.
    expect(insert.mock.calls[0][1].phone).toBe("+573001112233");
  });
});

describe("email is BEST EFFORT and never blocks the save", () => {
  it("succeeds when the team notice throws", async () => {
    notifyTeamOfInterest.mockRejectedValue(new Error("provider exploded"));

    const result = await createInvestmentInterest(VALID);

    // The row was written; that is what the user is told about.
    expect(insert).toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it("succeeds when the user confirmation throws", async () => {
    confirmInterestToUser.mockRejectedValue(new Error("smtp down"));

    const result = await createInvestmentInterest(VALID);

    expect(result.ok).toBe(true);
  });

  it("succeeds when no provider is configured at all", async () => {
    // A no-op provider simply resolves; nothing changes for the caller.
    notifyTeamOfInterest.mockResolvedValue(undefined);
    confirmInterestToUser.mockResolvedValue(undefined);

    const result = await createInvestmentInterest(VALID);

    expect(result.ok).toBe(true);
  });

  it("sends the notification only AFTER the row is saved", async () => {
    const order: string[] = [];
    insert.mockImplementation(async () => {
      order.push("insert");
      return { error: null };
    });
    notifyTeamOfInterest.mockImplementation(async () => {
      order.push("notify");
    });

    await createInvestmentInterest(VALID);

    expect(order).toEqual(["insert", "notify"]);
  });

  it("does NOT notify when the save itself failed", async () => {
    insert.mockResolvedValue({ error: { message: "denied by RLS" } });

    const result = await createInvestmentInterest(VALID);

    expect(result.ok).toBe(false);
    expect(notifyTeamOfInterest).not.toHaveBeenCalled();
    expect(confirmInterestToUser).not.toHaveBeenCalled();
  });
});
