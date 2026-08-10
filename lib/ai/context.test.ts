import { describe, expect, it } from "vitest";
import {
  buildInvestorContext,
  primaryProjectName,
  renderInvestorContext,
  resolveInvestorIds,
  type ChatContextClient,
} from "./context";

type Call = { table: string; method: string; args: unknown[] };

const CHAINABLE = [
  "select",
  "eq",
  "in",
  "is",
  "not",
  "gt",
  "order",
  "limit",
  // Write methods are here ONLY so the test can prove they are never called.
  "insert",
  "update",
  "upsert",
  "delete",
];

function mockClient(byTable: Record<string, { data?: unknown[]; error?: unknown }>) {
  const calls: Call[] = [];

  const client = {
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      for (const method of CHAINABLE) {
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
  } as unknown as ChatContextClient;

  return { client, calls };
}

const PROJECTS = [
  {
    id: "p1",
    name: "Villa Rotonda",
    city: "Rotonda",
    type: "casa",
    status: "construcción",
    progress: 62,
    in_fundraising: false,
  },
  {
    id: "p2",
    name: "Punta Gorda Lote 4",
    city: "Punta Gorda",
    type: "lote",
    status: "permisos",
    progress: 10,
    in_fundraising: true,
  },
];

const DATA = {
  projects: { data: PROJECTS },
  investor_project_position: {
    data: [
      {
        project_id: "p1",
        contributed: 100_000,
        current_capital: 80_000,
        returned_capital: 20_000,
        yield_received: 7_500,
      },
    ],
  },
  capital_contributions: {
    data: [{ project_id: "p1", agreed_return: "15% anual", capital_type: "equity" }],
  },
  transactions: {
    data: [
      { date: "2026-03-27", type: "aporte", amount: 100_000, project_id: "p1" },
      { date: "2026-05-02", type: "rendimiento", amount: 7_500, project_id: "p1" },
    ],
  },
  documents: {
    data: [{ name: "Contrato.pdf", doc_type: "contrato", date: "2026-02-01", project_id: "p1" }],
  },
  reassignment_requests: {
    data: [
      {
        amount: 10_000,
        status: "pendiente",
        requested_at: "2026-06-01",
        from_project_id: "p1",
        to_project_id: "p2",
      },
    ],
  },
};

const build = async (investorIds: string[], data = DATA) => {
  const { client, calls } = mockClient(data);
  const context = await buildInvestorContext(client, investorIds);
  return { context, calls };
};

/**
 * THE test of this feature. Everything else is convenience; this is the rule
 * from CLAUDE.md that must never break.
 */
describe("the context is scoped to the session's investor, always", () => {
  it("filters every private table by the investor ids it was given", async () => {
    const { calls } = await build(["inv-1"]);

    const scoped = calls.filter((call) => call.method === "in");
    const tables = scoped.map((call) => call.table).sort();

    expect(tables).toEqual([
      "capital_contributions",
      "investor_project_position",
      "reassignment_requests",
      "transactions",
    ]);
    for (const call of scoped) {
      expect(call.args).toEqual(["investor_id", ["inv-1"]]);
    }
  });

  it("never queries a private table without a scope", async () => {
    const { calls } = await build([]);

    // With no investor link the private reads must not happen AT ALL — an
    // unscoped select on these tables is exactly what would leak everything.
    const privateTables = [
      "investor_project_position",
      "capital_contributions",
      "transactions",
      "reassignment_requests",
    ];
    for (const table of privateTables) {
      expect(calls.some((call) => call.table === table)).toBe(false);
    }
  });

  it("still returns the PUBLIC catalogue when there is no investor link", async () => {
    const { context } = await build([]);

    expect(context.positions).toEqual([]);
    expect(context.catalog).toHaveLength(2);
  });

  it("scopes to exactly the ids passed, not to some wider set", async () => {
    const { calls } = await build(["inv-1", "inv-2"]);

    const positions = calls.find(
      (call) => call.table === "investor_project_position" && call.method === "in"
    );
    expect(positions!.args[1]).toEqual(["inv-1", "inv-2"]);
  });
});

describe("resolveInvestorIds", () => {
  it("filters investors by the user id from the session", async () => {
    const { client, calls } = mockClient({ investors: { data: [{ id: "inv-1" }] } });

    const ids = await resolveInvestorIds(client, "user-1");

    // The explicit user_id filter matters: RLS lets an admin read every
    // investors row, so without it an admin would pull in the whole platform.
    expect(calls).toContainEqual({
      table: "investors",
      method: "eq",
      args: ["user_id", "user-1"],
    });
    expect(ids).toEqual(["inv-1"]);
  });

  it("returns nothing when the read fails, never a partial scope", async () => {
    const { client } = mockClient({ investors: { error: { message: "down" } } });
    expect(await resolveInvestorIds(client, "user-1")).toEqual([]);
  });
});

describe("no writes, ever", () => {
  it("touches no table for writing while building a context", async () => {
    const { calls } = await build(["inv-1"]);

    // There is no chat history table and none is being created. A conversation
    // must leave no trace in the database.
    const writes = calls.filter((call) =>
      ["insert", "update", "upsert", "delete"].includes(call.method)
    );
    expect(writes).toEqual([]);
  });
});

describe("what the context contains", () => {
  it("sums the position into totals", async () => {
    const { context } = await build(["inv-1"]);

    expect(context.totals).toEqual({
      currentCapital: 80_000,
      contributed: 100_000,
      returnedCapital: 20_000,
      yieldReceived: 7_500,
      activeProjects: 1,
    });
  });

  it("joins the project name onto the position", async () => {
    const { context } = await build(["inv-1"]);

    expect(context.positions[0].projectName).toBe("Villa Rotonda");
    expect(context.positions[0].status).toBe("construcción");
  });

  it("carries the agreed return VERBATIM", async () => {
    const { context } = await build(["inv-1"]);

    // Free text by business rule: never normalised, never averaged.
    expect(context.positions[0].agreedReturn).toBe("15% anual");
  });

  it("names documents without exposing a file url", async () => {
    const { calls, context } = await build(["inv-1"]);

    const select = calls.find(
      (call) => call.table === "documents" && call.method === "select"
    );
    expect(select!.args[0]).not.toContain("file_url");
    expect(context.documents[0].name).toBe("Contrato.pdf");
  });

  it("orders positions by capital, so the biggest is the primary one", async () => {
    const { context } = await build(["inv-1"], {
      ...DATA,
      investor_project_position: {
        data: [
          { project_id: "p1", contributed: 10, current_capital: 10, returned_capital: 0, yield_received: 0 },
          { project_id: "p2", contributed: 90, current_capital: 90, returned_capital: 0, yield_received: 0 },
        ],
      },
    });

    expect(primaryProjectName(context)).toBe("Punta Gorda Lote 4");
  });

  it("has no primary project when there is no position", async () => {
    const { context } = await build([]);
    expect(primaryProjectName(context)).toBeNull();
  });
});

describe("rendering for the prompt", () => {
  it("pre-formats money with the project helper", async () => {
    const { context } = await build(["inv-1"]);
    const text = renderInvestorContext(context);

    // Handing the model raw decimals is the fastest route to a wrong figure.
    expect(text).toContain("$80,000");
    expect(text).toContain("$7,500");
  });

  it("pre-formats dates in es-CO", async () => {
    const { context } = await build(["inv-1"]);
    expect(renderInvestorContext(context)).toContain("27 mar 2026");
  });

  it("states plainly that there is no position instead of leaving a gap", async () => {
    const { context } = await build([]);
    const text = renderInvestorContext(context);

    // A silent gap is what invites the model to invent a number.
    expect(text).toMatch(/no tiene capital en ningún proyecto/i);
  });

  it("labels the public section as public", async () => {
    const { context } = await build(["inv-1"]);
    expect(renderInvestorContext(context)).toContain("PORTAFOLIO PÚBLICO");
  });
});
