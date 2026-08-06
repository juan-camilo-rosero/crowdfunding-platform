import { describe, expect, it } from "vitest";
import {
  getConvertibleUsers,
  searchConvertibleUsers,
  type UsersClient,
} from "./query";

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

const USERS = [
  { id: "u1", full_name: "Ana Pérez", email: "ana@ejemplo.com", phone: "+57300", created_at: "2026-03-01T00:00:00Z" },
  { id: "u2", full_name: "Beto Ruiz", email: "beto@ejemplo.com", phone: null, created_at: "2026-02-01T00:00:00Z" },
  { id: "u3", full_name: "Caro Gil", email: "caro@ejemplo.com", phone: null, created_at: "2026-01-01T00:00:00Z" },
];

const findCall = (calls: Call[], table: string, method: string, column: string) =>
  calls.find((c) => c.table === table && c.method === method && c.args[0] === column);

describe("population of convertible users", () => {
  it("excludes admins at the query level", async () => {
    const { client, calls } = mockClient({ users: { data: USERS }, investors: { data: [] } });
    await getConvertibleUsers(client);

    expect(findCall(calls, "users", "neq", "role")!.args[1]).toBe("admin");
  });

  it("requires a completed onboarding", async () => {
    const { client, calls } = mockClient({ users: { data: USERS }, investors: { data: [] } });
    await getConvertibleUsers(client);

    expect(findCall(calls, "users", "eq", "onboarding_completed")!.args[1]).toBe(true);
  });

  it("excludes users already linked to an investor record", async () => {
    const { client } = mockClient({
      users: { data: USERS },
      investors: { data: [{ user_id: "u2", email: "beto@ejemplo.com" }] },
    });

    const { users } = await getConvertibleUsers(client);

    expect(users.map((u) => u.id)).toEqual(["u1", "u3"]);
  });

  it("lists the newest registrations first", async () => {
    const { client, calls } = mockClient({ users: { data: USERS }, investors: { data: [] } });
    await getConvertibleUsers(client);

    expect(findCall(calls, "users", "order", "created_at")!.args[1]).toEqual({
      ascending: false,
    });
  });

  it("reports failure instead of an empty queue", async () => {
    const { client } = mockClient({
      users: { error: { message: "down" } },
      investors: { data: [] },
    });

    const result = await getConvertibleUsers(client);

    expect(result.failed).toBe(true);
    expect(result.users).toEqual([]);
  });
});

describe("prospect matching", () => {
  it("flags a user whose email matches an UNLINKED investor record", async () => {
    const { client } = mockClient({
      users: { data: USERS },
      investors: { data: [{ user_id: null, email: "ana@ejemplo.com" }] },
    });

    const { users } = await getConvertibleUsers(client);

    expect(users.find((u) => u.id === "u1")!.hasMatchingProspect).toBe(true);
    expect(users.find((u) => u.id === "u3")!.hasMatchingProspect).toBe(false);
  });

  it("matches case-insensitively and ignores surrounding spaces", async () => {
    const { client } = mockClient({
      users: { data: USERS },
      investors: { data: [{ user_id: null, email: "  ANA@Ejemplo.COM " }] },
    });

    const { users } = await getConvertibleUsers(client);
    expect(users.find((u) => u.id === "u1")!.hasMatchingProspect).toBe(true);
  });

  it("does NOT flag a match against an already-linked record", async () => {
    // Someone else's linked record happening to share an email must not read
    // as "a prospect is waiting to be connected".
    const { client } = mockClient({
      users: { data: [USERS[2]] },
      investors: { data: [{ user_id: "other-user", email: "caro@ejemplo.com" }] },
    });

    const { users } = await getConvertibleUsers(client);
    expect(users[0].hasMatchingProspect).toBe(false);
  });

  it("ignores unlinked records with no email at all", async () => {
    const { client } = mockClient({
      users: { data: USERS },
      investors: { data: [{ user_id: null, email: null }] },
    });

    const { users } = await getConvertibleUsers(client);
    expect(users.every((u) => !u.hasMatchingProspect)).toBe(true);
  });
});

describe("search", () => {
  const list = [
    { id: "u1", fullName: "Ana Pérez", email: "ana@ejemplo.com", phone: null, createdAt: "", hasMatchingProspect: false },
    { id: "u2", fullName: "Beto Ruiz", email: "beto@otro.com", phone: null, createdAt: "", hasMatchingProspect: false },
    { id: "u3", fullName: null, email: "sinnombre@ejemplo.com", phone: null, createdAt: "", hasMatchingProspect: false },
  ];

  it("returns everything for an empty query", () => {
    expect(searchConvertibleUsers(list, "   ")).toHaveLength(3);
  });

  it("matches on name, case-insensitively", () => {
    expect(searchConvertibleUsers(list, "ana").map((u) => u.id)).toEqual(["u1"]);
  });

  it("matches on email", () => {
    expect(searchConvertibleUsers(list, "otro.com").map((u) => u.id)).toEqual(["u2"]);
  });

  it("does not crash on a user with no name", () => {
    expect(searchConvertibleUsers(list, "sinnombre").map((u) => u.id)).toEqual(["u3"]);
  });
});
