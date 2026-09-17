import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Sending a notification reaches people's phones and cannot be recalled, so the
 * tests that cannot fail are: only an admin may send, the recipients are the
 * SERVER's idea of who an investor is (never the client's), and the action
 * writes rows and nothing else — no delivery work, because that belongs to the
 * push-send Edge Function.
 */

const ADMIN_ID = "00000000-0000-4000-8000-000000000000";
const LINKED_A = "11111111-1111-4111-8111-111111111111";
const LINKED_B = "22222222-2222-4222-8222-222222222222";
/** A real account that is NOT linked as an investor. */
const STRANGER = "33333333-3333-4333-8333-333333333333";

const getUser = vi.fn();
const insert = vi.fn();
const touched: string[] = [];
let callerRole: string | null = "admin";
let investorRows: unknown[] = [];
let insertError: unknown = null;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: (table: string) => {
      touched.push(table);
      const builder: Record<string, unknown> = {
        insert: (payload: unknown) => {
          insert(table, payload);
          return Promise.resolve({ data: null, error: insertError });
        },
      };
      for (const method of ["select", "eq", "not", "is", "limit", "order"]) {
        builder[method] = () => builder;
      }
      const answer = () => {
        if (table === "users") {
          return { data: callerRole ? { role: callerRole } : null, error: null };
        }
        return { data: investorRows, error: null };
      };
      builder.single = async () => answer();
      builder.maybeSingle = async () => answer();
      builder.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve(answer()).then(resolve);
      return builder;
    },
  }),
}));

const { sendNotification } = await import("./actions");

const MESSAGE = { title: "Nuevo reporte", body: "Ya está publicado." };

beforeEach(() => {
  vi.clearAllMocks();
  touched.length = 0;
  callerRole = "admin";
  insertError = null;
  investorRows = [
    { user_id: LINKED_A, full_name: "Ana", email: "ana@ejemplo.com" },
    { user_id: LINKED_B, full_name: "Beto", email: "beto@ejemplo.com" },
  ];
  getUser.mockResolvedValue({ data: { user: { id: ADMIN_ID } } });
});

/** The user ids the action asked the database to write, in order. */
function insertedUserIds(): string[] {
  const rows = insert.mock.calls[0]?.[1] as { user_id: string }[] | undefined;
  return (rows ?? []).map((row) => row.user_id);
}

describe("sendNotification", () => {
  it("refuses a caller who is not an admin, and writes nothing", async () => {
    callerRole = "visitante";

    const result = await sendNotification({
      ...MESSAGE,
      audience: "all",
      userIds: [],
    });

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(insert).not.toHaveBeenCalled();
  });

  it("refuses an unauthenticated caller", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const result = await sendNotification({
      ...MESSAGE,
      audience: "all",
      userIds: [],
    });

    expect(result.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it("writes one row per linked investor when the audience is everyone", async () => {
    const result = await sendNotification({
      ...MESSAGE,
      audience: "all",
      userIds: [],
    });

    expect(result).toEqual({ ok: true, count: 2 });
    expect(insertedUserIds()).toEqual([LINKED_A, LINKED_B]);
  });

  it("counts a person once when two investor records point at their account", async () => {
    investorRows = [
      { user_id: LINKED_A, full_name: "Ana", email: "ana@ejemplo.com" },
      { user_id: LINKED_A, full_name: "Ana Pérez", email: "ana@otro.com" },
    ];

    const result = await sendNotification({
      ...MESSAGE,
      audience: "all",
      userIds: [],
    });

    expect(result).toEqual({ ok: true, count: 1 });
    expect(insertedUserIds()).toEqual([LINKED_A]);
  });

  it("ignores ids that are not linked investors, however the payload was built", async () => {
    const result = await sendNotification({
      ...MESSAGE,
      audience: "selected",
      userIds: [LINKED_B, STRANGER],
    });

    expect(result).toEqual({ ok: true, count: 1 });
    expect(insertedUserIds()).toEqual([LINKED_B]);
  });

  it("fails when none of the chosen people is still an investor", async () => {
    const result = await sendNotification({
      ...MESSAGE,
      audience: "selected",
      userIds: [STRANGER],
    });

    expect(result.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects an empty selection before reaching the database", async () => {
    const result = await sendNotification({
      ...MESSAGE,
      audience: "selected",
      userIds: [],
    });

    expect(result.ok).toBe(false);
    expect(touched).toEqual([]);
  });

  it("rejects a message with no title", async () => {
    const result = await sendNotification({
      title: "   ",
      body: MESSAGE.body,
      audience: "all",
      userIds: [],
    });

    expect(result.ok).toBe(false);
    expect(touched).toEqual([]);
  });

  it("reports a failed write instead of claiming it was sent", async () => {
    insertError = { message: "boom" };

    const result = await sendNotification({
      ...MESSAGE,
      audience: "all",
      userIds: [],
    });

    expect(result.ok).toBe(false);
  });

  it("touches only users, investors and notifications — delivery is not its job", async () => {
    await sendNotification({ ...MESSAGE, audience: "all", userIds: [] });

    expect(new Set(touched)).toEqual(
      new Set(["users", "investors", "notifications"])
    );
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).toBe("notifications");
  });

  it("stores the routing type the mobile app switches on", async () => {
    await sendNotification({ ...MESSAGE, audience: "all", userIds: [] });

    const rows = insert.mock.calls[0][1] as { data: { type: string } }[];
    expect(rows[0].data).toEqual({ type: "admin_message" });
  });
});
