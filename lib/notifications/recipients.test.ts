import { describe, expect, it } from "vitest";
import {
  getNotificationRecipients,
  searchRecipients,
  type RecipientsClient,
} from "./recipients";

/**
 * The recipient list decides who a notification reaches, so what matters here
 * is the definition of "investor" (a LINKED row) and the guarantee that one
 * person appears — and is notified — once.
 */

/** Records the query the code built, then answers with fixed rows. */
function clientReturning(
  data: unknown[] | null,
  error: unknown = null
): { client: RecipientsClient; calls: string[] } {
  const calls: string[] = [];

  const builder = {
    select: (columns: string) => {
      calls.push(`select:${columns}`);
      return builder;
    },
    not: (column: string, operator: string, value: unknown) => {
      calls.push(`not:${column}:${operator}:${String(value)}`);
      return builder;
    },
    order: (column: string, options: { ascending: boolean }) => {
      calls.push(`order:${column}:${options.ascending}`);
      return builder;
    },
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data, error }).then(resolve),
  } as unknown as ReturnType<RecipientsClient["from"]>;

  return {
    client: {
      from: (table: string) => {
        calls.push(`from:${table}`);
        return builder;
      },
    },
    calls,
  };
}

describe("getNotificationRecipients", () => {
  it("asks only for investors that have an account", async () => {
    const { client, calls } = clientReturning([]);

    await getNotificationRecipients(client);

    expect(calls).toContain("from:investors");
    expect(calls).toContain("not:user_id:is:null");
  });

  it("maps a linked investor to the user id notifications are keyed by", async () => {
    const { client } = clientReturning([
      { user_id: "user-1", full_name: "Ana", email: "ana@ejemplo.com" },
    ]);

    const { recipients, failed } = await getNotificationRecipients(client);

    expect(failed).toBe(false);
    expect(recipients).toEqual([
      { userId: "user-1", fullName: "Ana", email: "ana@ejemplo.com" },
    ]);
  });

  it("lists a person once when two investor records point at their account", async () => {
    const { client } = clientReturning([
      { user_id: "user-1", full_name: "Ana", email: "ana@ejemplo.com" },
      { user_id: "user-1", full_name: "Ana Pérez", email: "ana@otro.com" },
      { user_id: "user-2", full_name: "Beto", email: "beto@ejemplo.com" },
    ]);

    const { recipients } = await getNotificationRecipients(client);

    expect(recipients.map((recipient) => recipient.userId)).toEqual([
      "user-1",
      "user-2",
    ]);
  });

  it("drops a prospect with no account, even if the filter let it through", async () => {
    const { client } = clientReturning([
      { user_id: null, full_name: "Prospecto", email: "p@ejemplo.com" },
      { user_id: "user-2", full_name: "Beto", email: "beto@ejemplo.com" },
    ]);

    const { recipients } = await getNotificationRecipients(client);

    expect(recipients.map((recipient) => recipient.userId)).toEqual(["user-2"]);
  });

  it("reports a failed read instead of an empty audience", async () => {
    const { client } = clientReturning(null, { message: "boom" });

    const result = await getNotificationRecipients(client);

    expect(result).toEqual({ recipients: [], failed: true });
  });
});

describe("searchRecipients", () => {
  const recipients = [
    { userId: "1", fullName: "Ana Pérez", email: "ana@ejemplo.com" },
    { userId: "2", fullName: "Beto Ruiz", email: "beto@otro.com" },
    { userId: "3", fullName: null, email: null },
  ];

  it("returns everyone for an empty query", () => {
    expect(searchRecipients(recipients, "   ")).toHaveLength(3);
  });

  it("matches on name, ignoring case", () => {
    expect(searchRecipients(recipients, "ANA")).toEqual([recipients[0]]);
  });

  it("matches on email", () => {
    expect(searchRecipients(recipients, "otro.com")).toEqual([recipients[1]]);
  });

  it("does not break on a record with neither name nor email", () => {
    expect(searchRecipients(recipients, "zzz")).toEqual([]);
  });
});
