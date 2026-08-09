import { describe, expect, it } from "vitest";
import { getUserDirectory, searchUsers, type UsersClient } from "./query";
import {
  matchesFilter,
  notConvertibleReason,
  type UserDirectoryEntry,
} from "./convertible";

type Call = { table: string; method: string; args: unknown[] };

/** Chainable mock answering per table. */
function mockClient(
  byTable: Record<string, { data?: unknown[]; error?: unknown }>
) {
  const calls: Call[] = [];

  const client = {
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq", "neq", "is", "not", "order"]) {
        builder[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          return builder;
        };
      }
      builder.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve({
          data: byTable[table]?.data ?? [],
          error: byTable[table]?.error ?? null,
        }).then(resolve);
      return builder;
    },
  } as unknown as UsersClient;

  return { client, calls };
}

const user = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "u1",
  full_name: "Ana Pérez",
  email: "ana@ejemplo.com",
  phone: "+57300",
  role: "visitante",
  onboarding_completed: true,
  created_at: "2026-03-01T00:00:00Z",
  ...over,
});

const VISITOR = user();
const PENDING = user({ id: "u2", email: "beto@ejemplo.com", full_name: "Beto Ruiz", onboarding_completed: false });
const ADMIN = user({ id: "u3", email: "caro@ejemplo.com", full_name: "Caro Gil", role: "admin" });
const LINKED = user({ id: "u4", email: "dana@ejemplo.com", full_name: "Dana Sol" });

const ALL = [VISITOR, PENDING, ADMIN, LINKED];
/** u4 is an investor; u3 (admin) also holds a link — the owner's case. */
const INVESTORS = [
  { user_id: "u4", email: "dana@ejemplo.com" },
  { user_id: "u3", email: "caro@ejemplo.com" },
];

const directory = async (
  users: unknown[] = ALL,
  investors: unknown[] = INVESTORS
) => {
  const { client } = mockClient({
    users: { data: users },
    investors: { data: investors },
  });
  return getUserDirectory(client);
};

const byId = (list: UserDirectoryEntry[], id: string) =>
  list.find((entry) => entry.id === id)!;

describe("the directory lists everyone", () => {
  it("includes visitors, investors and admins alike", async () => {
    const { users } = await directory();

    // The old screen returned only pending conversions, so a converted person
    // disappeared with no confirmation.
    expect(users.map((entry) => entry.id).sort()).toEqual(["u1", "u2", "u3", "u4"]);
  });

  it("includes people who have not finished onboarding", async () => {
    const { users } = await directory();
    expect(byId(users, "u2")).toBeDefined();
  });

  it("lists the newest registrations first", async () => {
    const { client, calls } = mockClient({
      users: { data: ALL },
      investors: { data: INVESTORS },
    });
    await getUserDirectory(client);

    const order = calls.find((c) => c.table === "users" && c.method === "order");
    expect(order!.args).toEqual(["created_at", { ascending: false }]);
  });

  it("reports failure instead of an empty directory", async () => {
    const { client } = mockClient({
      users: { error: { message: "down" } },
      investors: { data: [] },
    });

    const result = await getUserDirectory(client);
    expect(result.failed).toBe(true);
    expect(result.users).toEqual([]);
  });
});

describe("capabilities are independent axes", () => {
  it("marks a plain visitor as neither", async () => {
    const entry = byId((await directory()).users, "u1");
    expect(entry.isAdmin).toBe(false);
    expect(entry.isInvestor).toBe(false);
  });

  it("marks a linked user as an investor without touching role", async () => {
    const entry = byId((await directory()).users, "u4");
    expect(entry.isInvestor).toBe(true);
    // Being an investor is derived from the link, never from users.role.
    expect(entry.isAdmin).toBe(false);
  });

  it("carries BOTH for an admin who also invests (the owner)", async () => {
    const entry = byId((await directory()).users, "u3");
    expect(entry.isAdmin).toBe(true);
    expect(entry.isInvestor).toBe(true);
  });
});

describe("canConvert mirrors what the server enforces", () => {
  it("is true only for an onboarded visitor with no link", async () => {
    const { users } = await directory();
    expect(users.filter((entry) => entry.canConvert).map((e) => e.id)).toEqual(["u1"]);
  });

  it("is false, with a reason, for each blocked case", async () => {
    const { users } = await directory();

    expect(notConvertibleReason(byId(users, "u2"))).toBe("onboarding-pending");
    expect(notConvertibleReason(byId(users, "u4"))).toBe("already-investor");
    expect(notConvertibleReason(byId(users, "u1"))).toBeNull();

    // u3 is admin AND investor. Both conditions block the conversion; the
    // reason shown is the informative one.
    expect(notConvertibleReason(byId(users, "u3"))).toBe("already-investor");
  });

  it("says 'is-admin' for an admin with no link", async () => {
    const { users } = await directory([ADMIN], []);

    expect(users[0].canConvert).toBe(false);
    expect(notConvertibleReason(users[0])).toBe("is-admin");
  });
});

describe("prospect matching", () => {
  it("flags a user whose email matches an UNLINKED investor record", async () => {
    const { users } = await directory(ALL, [
      ...INVESTORS,
      { user_id: null, email: "ana@ejemplo.com" },
    ]);

    expect(byId(users, "u1").hasMatchingProspect).toBe(true);
    expect(byId(users, "u2").hasMatchingProspect).toBe(false);
  });

  it("matches case-insensitively and ignores surrounding spaces", async () => {
    const { users } = await directory(ALL, [
      { user_id: null, email: "  ANA@Ejemplo.COM " },
    ]);
    expect(byId(users, "u1").hasMatchingProspect).toBe(true);
  });

  it("does NOT flag a match against an already-linked record", async () => {
    // Someone else's linked record sharing an email must not read as "a
    // prospect is waiting to be connected".
    const { users } = await directory([VISITOR], [
      { user_id: "other-user", email: "ana@ejemplo.com" },
    ]);
    expect(users[0].hasMatchingProspect).toBe(false);
  });

  it("ignores unlinked records with no email at all", async () => {
    const { users } = await directory(ALL, [{ user_id: null, email: null }]);
    expect(users.every((entry) => !entry.hasMatchingProspect)).toBe(true);
  });
});

describe("filtering", () => {
  it("'todos' keeps everyone", async () => {
    const { users } = await directory();
    expect(users.filter((u) => matchesFilter(u, "todos"))).toHaveLength(4);
  });

  it("'visitante' means NEITHER capability", async () => {
    const { users } = await directory();
    expect(
      users.filter((u) => matchesFilter(u, "visitante")).map((u) => u.id).sort()
    ).toEqual(["u1", "u2"]);
  });

  it("an admin who invests appears under BOTH filters", async () => {
    const { users } = await directory();

    expect(users.filter((u) => matchesFilter(u, "admin")).map((u) => u.id)).toEqual(["u3"]);
    expect(
      users.filter((u) => matchesFilter(u, "inversionista")).map((u) => u.id).sort()
    ).toEqual(["u3", "u4"]);
  });
});

describe("search", () => {
  const list = [
    { id: "u1", fullName: "Ana Pérez", email: "ana@ejemplo.com" },
    { id: "u2", fullName: "Beto Ruiz", email: "beto@otro.com" },
    { id: "u3", fullName: null, email: "sinnombre@ejemplo.com" },
  ] as UserDirectoryEntry[];

  it("returns everything for an empty query", () => {
    expect(searchUsers(list, "   ")).toHaveLength(3);
  });

  it("matches on name, case-insensitively", () => {
    expect(searchUsers(list, "ana").map((u) => u.id)).toEqual(["u1"]);
  });

  it("matches on email", () => {
    expect(searchUsers(list, "otro.com").map((u) => u.id)).toEqual(["u2"]);
  });

  it("does not crash on a user with no name", () => {
    expect(searchUsers(list, "sinnombre").map((u) => u.id)).toEqual(["u3"]);
  });
});
