import { describe, expect, it } from "vitest";
import {
  fetchInvestorTransactions,
  fetchTransactionFilterOptions,
  type TransactionsClient,
} from "./query";

/**
 * Data-scoping tests.
 *
 * These are the important ones: they assert that the query can never be built
 * without the investor scope, whatever the caller passes as filters. Supabase
 * itself is mocked — what is under test is OUR query construction, not
 * PostgREST.
 */

type Call = { method: string; args: unknown[] };

/** Records every chained call and resolves with the rows it was given. */
function mockClient(rows: unknown[], error: unknown = null) {
  const calls: Call[] = [];
  const tables: string[] = [];

  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  // The builder is thenable, which is how the real client resolves.
  builder.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data: rows, error }).then(resolve);

  const client = {
    from: (table: string) => {
      tables.push(table);
      return builder;
    },
  } as unknown as TransactionsClient;

  return { client, calls, tables };
}

const ROWS = [
  { id: "t1", date: "2026-03-27", type: "aporte", amount: "45926", project_id: "p1", projects: { id: "p1", name: "Villa Rotonda 118" } },
  { id: "t2", date: "2026-02-10", type: "rendimiento", amount: "1500", project_id: "p1", projects: { id: "p1", name: "Villa Rotonda 118" } },
  { id: "t3", date: "2026-01-05", type: "devolución de capital", amount: "20000", project_id: "p2", projects: { id: "p2", name: "North Port Lote 7" } },
];

const findCall = (calls: Call[], method: string, column: string) =>
  calls.find((call) => call.method === method && call.args[0] === column);

describe("fetchInvestorTransactions — scoping", () => {
  it("always filters by the caller's investor ids", async () => {
    const { client, calls, tables } = mockClient(ROWS);
    await fetchInvestorTransactions(client, ["inv-a"]);

    expect(tables).toEqual(["transactions"]);
    const scope = findCall(calls, "in", "investor_id");
    expect(scope).toBeDefined();
    expect(scope!.args[1]).toEqual(["inv-a"]);
  });

  it("keeps the scope even when filters are applied", async () => {
    const { client, calls } = mockClient(ROWS);
    await fetchInvestorTransactions(client, ["inv-a"], {
      projectId: "p1",
      type: "aporte",
    });

    expect(findCall(calls, "in", "investor_id")!.args[1]).toEqual(["inv-a"]);
    expect(findCall(calls, "eq", "project_id")!.args[1]).toBe("p1");
    expect(findCall(calls, "eq", "type")!.args[1]).toBe("aporte");
  });

  it("never queries without a scope: no investor link returns nothing", async () => {
    const { client, tables } = mockClient(ROWS);
    const result = await fetchInvestorTransactions(client, []);

    // The important half: it did not fall through to an unscoped query.
    expect(tables).toEqual([]);
    expect(result.transactions).toEqual([]);
  });

  it("a forged project id cannot widen the scope — it only adds a filter", async () => {
    const { client, calls } = mockClient([]);
    await fetchInvestorTransactions(client, ["inv-a"], {
      projectId: "project-of-another-investor",
      type: null,
    });

    // investor_id is still pinned to the caller; the forged id narrows further.
    expect(findCall(calls, "in", "investor_id")!.args[1]).toEqual(["inv-a"]);
    expect(findCall(calls, "eq", "project_id")!.args[1]).toBe(
      "project-of-another-investor"
    );
  });

  it("ignores a movement type that is not a stored value", async () => {
    const { client, calls } = mockClient(ROWS);
    await fetchInvestorTransactions(client, ["inv-a"], {
      projectId: null,
      type: "inventado",
    });

    // No type filter is applied at all, so the full history shows.
    expect(findCall(calls, "eq", "type")).toBeUndefined();
  });

  it("orders by date, newest first", async () => {
    const { client, calls } = mockClient(ROWS);
    await fetchInvestorTransactions(client, ["inv-a"]);

    const order = findCall(calls, "order", "date");
    expect(order).toBeDefined();
    expect(order!.args[1]).toEqual({ ascending: false });
  });

  it("scopes across every investor row the user holds", async () => {
    const { client, calls } = mockClient(ROWS);
    await fetchInvestorTransactions(client, ["inv-a", "inv-b"]);

    expect(findCall(calls, "in", "investor_id")!.args[1]).toEqual([
      "inv-a",
      "inv-b",
    ]);
  });
});

describe("fetchInvestorTransactions — mapping", () => {
  it("joins the project name instead of exposing the raw id", async () => {
    const { client } = mockClient(ROWS);
    const { transactions } = await fetchInvestorTransactions(client, ["inv-a"]);

    expect(transactions[0].projectName).toBe("Villa Rotonda 118");
    expect(transactions[2].projectName).toBe("North Port Lote 7");
  });

  it("coerces the amount to a number", async () => {
    const { client } = mockClient(ROWS);
    const { transactions } = await fetchInvestorTransactions(client, ["inv-a"]);

    expect(transactions[0].amount).toBe(45926);
    expect(typeof transactions[0].amount).toBe("number");
  });

  it("accepts an embedded project delivered as an array", async () => {
    const { client } = mockClient([
      { ...ROWS[0], projects: [{ id: "p1", name: "Villa Rotonda 118" }] },
    ]);
    const { transactions } = await fetchInvestorTransactions(client, ["inv-a"]);

    expect(transactions[0].projectName).toBe("Villa Rotonda 118");
  });

  it("survives a transaction with no project", async () => {
    const { client } = mockClient([{ ...ROWS[0], projects: null, project_id: null }]);
    const { transactions } = await fetchInvestorTransactions(client, ["inv-a"]);

    expect(transactions[0].projectName).toBe("");
  });

  it("reports failure instead of pretending the history is empty", async () => {
    const { client } = mockClient([], { message: "network down" });
    const result = await fetchInvestorTransactions(client, ["inv-a"]);

    expect(result.failed).toBe(true);
    expect(result.transactions).toEqual([]);
  });
});

describe("fetchTransactionFilterOptions", () => {
  it("is scoped to the caller's investor ids", async () => {
    const { client, calls } = mockClient(ROWS);
    await fetchTransactionFilterOptions(client, ["inv-a"]);

    expect(findCall(calls, "in", "investor_id")!.args[1]).toEqual(["inv-a"]);
  });

  it("offers only projects this investor has movements in", async () => {
    const { client } = mockClient(ROWS);
    const { projectOptions } = await fetchTransactionFilterOptions(client, ["inv-a"]);

    expect(projectOptions).toEqual([
      { id: "p2", name: "North Port Lote 7" },
      { id: "p1", name: "Villa Rotonda 118" },
    ]);
  });

  it("offers only movement types present in this investor's history", async () => {
    const { client } = mockClient(ROWS);
    const { typeOptions } = await fetchTransactionFilterOptions(client, ["inv-a"]);

    expect(typeOptions.sort()).toEqual(
      ["aporte", "devolución de capital", "rendimiento"].sort()
    );
    // 'reasignación' exists in the schema but not in this history.
    expect(typeOptions).not.toContain("reasignación");
  });

  it("does not query at all without an investor link", async () => {
    const { client, tables } = mockClient(ROWS);
    const result = await fetchTransactionFilterOptions(client, []);

    expect(tables).toEqual([]);
    expect(result.projectOptions).toEqual([]);
  });
});
