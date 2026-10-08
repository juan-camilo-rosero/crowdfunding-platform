import { beforeEach, describe, expect, it, vi } from "vitest";
import { es } from "@/i18n";

/**
 * Deleting an account is the most destructive thing the panel can do, so the
 * tests that cannot fail are: only an admin does it, never to themselves,
 * never to the last admin, and the investor's financial file is NOT touched.
 */

const TARGET_ID = "11111111-1111-4111-8111-111111111111";
const CALLER_ID = "22222222-2222-4222-8222-222222222222";

const getUser = vi.fn();
const deleteUser = vi.fn();
/** Tables the session client touched, to prove nothing financial was written. */
const touched: string[] = [];
const writes: string[] = [];

let callerRole = "admin";
let target: Record<string, unknown> | null = null;
let investorLink: unknown[] = [];
let adminCount = 2;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ auth: { admin: { deleteUser } } }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: (table: string) => {
      touched.push(table);
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq", "is", "not", "neq", "limit", "order"]) {
        builder[method] = () => builder;
      }
      for (const method of ["insert", "update", "delete", "upsert"]) {
        builder[method] = () => {
          writes.push(`${table}.${method}`);
          return builder;
        };
      }
      const answer = () => {
        if (table === "users") {
          // The caller's own row is read first, the target second.
          return touched.filter((t) => t === "users").length === 1
            ? { data: { role: callerRole }, error: null, count: null }
            : { data: target, error: null, count: adminCount };
        }
        if (table === "investors") return { data: investorLink, error: null, count: null };
        return { data: null, error: null, count: null };
      };
      builder.single = async () => answer();
      builder.maybeSingle = async () => answer();
      builder.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve(answer()).then(resolve);
      return builder;
    },
  }),
}));

const { deleteUserAccount } = await import("./delete-actions");

beforeEach(() => {
  vi.clearAllMocks();
  touched.length = 0;
  writes.length = 0;
  callerRole = "admin";
  adminCount = 2;
  investorLink = [];
  target = { id: TARGET_ID, email: "ana@ejemplo.com", full_name: "Ana Pérez", role: "visitante" };
  getUser.mockResolvedValue({ data: { user: { id: CALLER_ID } } });
  deleteUser.mockResolvedValue({ error: null });
});

describe("who may delete", () => {
  it("refuses a caller who is not an admin, and deletes nothing", async () => {
    callerRole = "visitante";

    const result = await deleteUserAccount({ userId: TARGET_ID });

    expect(result).toEqual({ ok: false, error: es.adminUsers.errors.notAdmin });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("refuses a caller with no session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const result = await deleteUserAccount({ userId: TARGET_ID });

    expect(result.ok).toBe(false);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("refuses deleting your own account", async () => {
    target = { id: CALLER_ID, email: "yo@ejemplo.com", full_name: "Yo", role: "admin" };

    const result = await deleteUserAccount({ userId: CALLER_ID });

    expect(result).toEqual({ ok: false, error: es.adminUsers.errors.deleteSelf });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("refuses deleting the last admin", async () => {
    target = { id: TARGET_ID, email: "jefa@ejemplo.com", full_name: "Jefa", role: "admin" };
    adminCount = 1;

    const result = await deleteUserAccount({ userId: TARGET_ID });

    expect(result).toEqual({ ok: false, error: es.adminUsers.errors.deleteLastAdmin });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("deletes an admin when another one remains", async () => {
    target = { id: TARGET_ID, email: "otro@ejemplo.com", full_name: "Otro", role: "admin" };
    adminCount = 2;

    const result = await deleteUserAccount({ userId: TARGET_ID });

    expect(result.ok).toBe(true);
    expect(deleteUser).toHaveBeenCalledWith(TARGET_ID);
  });

  it("refuses an id that is not a uuid, without asking the database", async () => {
    const result = await deleteUserAccount({ userId: "no-soy-un-uuid" });

    expect(result.ok).toBe(false);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("says so when the account no longer exists", async () => {
    target = null;

    const result = await deleteUserAccount({ userId: TARGET_ID });

    expect(result).toEqual({ ok: false, error: es.adminUsers.errors.notFound });
    expect(deleteUser).not.toHaveBeenCalled();
  });
});

describe("what deleting touches", () => {
  it("deletes the auth account and nothing else", async () => {
    const result = await deleteUserAccount({ userId: TARGET_ID });

    expect(result).toEqual({ ok: true, keptInvestorRecord: false });
    expect(deleteUser).toHaveBeenCalledWith(TARGET_ID);
    // No insert/update/delete on any table: the cascade does the rest.
    expect(writes).toEqual([]);
  });

  it("NEVER writes to the financial tables", async () => {
    await deleteUserAccount({ userId: TARGET_ID });

    for (const table of ["capital_contributions", "transactions", "investors"]) {
      expect(writes.some((write) => write.startsWith(table))).toBe(false);
    }
  });

  it("reports that a linked investor's file survives", async () => {
    investorLink = [{ id: "inv-1" }];

    const result = await deleteUserAccount({ userId: TARGET_ID });

    expect(result).toEqual({ ok: true, keptInvestorRecord: true });
  });

  it("surfaces a failure from the auth service instead of claiming success", async () => {
    deleteUser.mockResolvedValue({ error: { message: "boom" } });

    const result = await deleteUserAccount({ userId: TARGET_ID });

    expect(result).toEqual({ ok: false, error: es.adminUsers.errors.deleteFailed });
  });

  it("does not crash when the service role key is missing", async () => {
    deleteUser.mockRejectedValue(new Error("SUPABASE_SERVICE_ROLE_KEY is not configured."));

    const result = await deleteUserAccount({ userId: TARGET_ID });

    expect(result).toEqual({ ok: false, error: es.adminUsers.errors.deleteFailed });
  });
});
