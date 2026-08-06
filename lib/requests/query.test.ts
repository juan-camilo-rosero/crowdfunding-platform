import { describe, expect, it } from "vitest";
import { es } from "@/i18n";
import {
  fetchInvestorRequests,
  fetchRequestFilterOptions,
  type RequestsClient,
} from "./query";
import { REQUEST_PARAMS, parseRequestFilters } from "./params";
import { REQUEST_STATUSES, requestStatusVariant } from "./types";

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
  builder.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data: rows, error }).then(resolve);

  return {
    client: {
      from: (table: string) => {
        tables.push(table);
        return builder;
      },
    } as unknown as RequestsClient,
    calls,
    tables,
  };
}

const ROWS = [
  { id: "r1", requested_at: "2026-06-30", amount: "15000", status: "pendiente", from_project_id: "p1", to_project_id: "p2", from_project: { id: "p1", name: "Villa Rotonda 118" }, to_project: { id: "p2", name: "North Port Lote 7" } },
  { id: "r2", requested_at: "2026-04-10", amount: "8000", status: "aprobada", from_project_id: "p2", to_project_id: "p3", from_project: { id: "p2", name: "North Port Lote 7" }, to_project: { id: "p3", name: "Punta Gorda Lote 9" } },
  { id: "r3", requested_at: "2026-01-05", amount: "3000", status: "rechazada", from_project_id: "p1", to_project_id: "p2", from_project: { id: "p1", name: "Villa Rotonda 118" }, to_project: { id: "p2", name: "North Port Lote 7" } },
];

const findCall = (calls: Call[], method: string, column: string) =>
  calls.find((c) => c.method === method && c.args[0] === column);

describe("fetchInvestorRequests — scoping", () => {
  it("always filters by the caller's investor ids", async () => {
    const { client, calls, tables } = mockClient(ROWS);
    await fetchInvestorRequests(client, ["inv-a"]);

    expect(tables).toEqual(["reassignment_requests"]);
    expect(findCall(calls, "in", "investor_id")!.args[1]).toEqual(["inv-a"]);
  });

  it("keeps the scope even with both filters applied", async () => {
    const { client, calls } = mockClient(ROWS);
    await fetchInvestorRequests(client, ["inv-a"], {
      toProjectId: "p2",
      status: "aprobada",
    });

    expect(findCall(calls, "in", "investor_id")!.args[1]).toEqual(["inv-a"]);
    expect(findCall(calls, "eq", "to_project_id")!.args[1]).toBe("p2");
    expect(findCall(calls, "eq", "status")!.args[1]).toBe("aprobada");
  });

  it("never queries without a scope: no investor link returns nothing", async () => {
    const { client, tables } = mockClient(ROWS);
    const result = await fetchInvestorRequests(client, []);

    expect(tables).toEqual([]);
    expect(result.requests).toEqual([]);
  });

  it("a forged destination id only narrows: it cannot add rows", async () => {
    const { client, calls } = mockClient([]);
    const result = await fetchInvestorRequests(client, ["inv-a"], {
      toProjectId: "project-of-another-investor",
      status: null,
    });

    expect(findCall(calls, "in", "investor_id")!.args[1]).toEqual(["inv-a"]);
    expect(findCall(calls, "eq", "to_project_id")!.args[1]).toBe(
      "project-of-another-investor"
    );
    expect(result.requests).toEqual([]);
  });

  it("ignores a status that is not a stored value", async () => {
    const { client, calls } = mockClient(ROWS);
    await fetchInvestorRequests(client, ["inv-a"], {
      toProjectId: null,
      status: "inventado",
    });

    expect(findCall(calls, "eq", "status")).toBeUndefined();
  });

  it("orders by requested_at, newest first", async () => {
    const { client, calls } = mockClient(ROWS);
    await fetchInvestorRequests(client, ["inv-a"]);

    expect(findCall(calls, "order", "requested_at")!.args[1]).toEqual({
      ascending: false,
    });
  });

  it("scopes across every investor row the user holds", async () => {
    const { client, calls } = mockClient(ROWS);
    await fetchInvestorRequests(client, ["inv-a", "inv-b"]);

    expect(findCall(calls, "in", "investor_id")!.args[1]).toEqual([
      "inv-a",
      "inv-b",
    ]);
  });
});

describe("fetchInvestorRequests — filtering", () => {
  it("filters by destination project", async () => {
    const { client, calls } = mockClient([ROWS[0], ROWS[2]]);
    const result = await fetchInvestorRequests(client, ["inv-a"], {
      toProjectId: "p2",
      status: null,
    });

    expect(findCall(calls, "eq", "to_project_id")!.args[1]).toBe("p2");
    expect(findCall(calls, "eq", "status")).toBeUndefined();
    expect(result.requests).toHaveLength(2);
  });

  it("filters by status", async () => {
    const { client, calls } = mockClient([ROWS[1]]);
    const result = await fetchInvestorRequests(client, ["inv-a"], {
      toProjectId: null,
      status: "aprobada",
    });

    expect(findCall(calls, "eq", "status")!.args[1]).toBe("aprobada");
    expect(findCall(calls, "eq", "to_project_id")).toBeUndefined();
    expect(result.requests[0].status).toBe("aprobada");
  });

  it("a combination with no matches returns an empty list, not a failure", async () => {
    const { client } = mockClient([]);
    const result = await fetchInvestorRequests(client, ["inv-a"], {
      toProjectId: "p3",
      status: "rechazada",
    });

    expect(result.requests).toEqual([]);
    expect(result.failed).toBe(false);
  });
});

describe("fetchInvestorRequests — mapping", () => {
  it("resolves BOTH project names, never the raw ids", async () => {
    const { client } = mockClient(ROWS);
    const { requests } = await fetchInvestorRequests(client, ["inv-a"]);

    expect(requests[0].fromProjectName).toBe("Villa Rotonda 118");
    expect(requests[0].toProjectName).toBe("North Port Lote 7");
    expect(requests[1].fromProjectName).toBe("North Port Lote 7");
    expect(requests[1].toProjectName).toBe("Punta Gorda Lote 9");
  });

  it("coerces the amount to a number", async () => {
    const { client } = mockClient(ROWS);
    const { requests } = await fetchInvestorRequests(client, ["inv-a"]);

    expect(requests[0].amount).toBe(15000);
    expect(typeof requests[0].amount).toBe("number");
  });

  it("accepts embedded projects delivered as arrays", async () => {
    const { client } = mockClient([
      {
        ...ROWS[0],
        from_project: [{ id: "p1", name: "Villa Rotonda 118" }],
        to_project: [{ id: "p2", name: "North Port Lote 7" }],
      },
    ]);
    const { requests } = await fetchInvestorRequests(client, ["inv-a"]);

    expect(requests[0].fromProjectName).toBe("Villa Rotonda 118");
    expect(requests[0].toProjectName).toBe("North Port Lote 7");
  });

  it("falls back to a label, never a blank, when a project does not resolve", async () => {
    const { client } = mockClient([
      { ...ROWS[0], from_project: null, to_project: null },
    ]);
    const { requests } = await fetchInvestorRequests(client, ["inv-a"]);

    expect(requests[0].fromProjectName).toBe(es.requests.unknownProject);
    expect(requests[0].toProjectName).toBe(es.requests.unknownProject);
  });

  it("reports failure instead of pretending there are no requests", async () => {
    const { client } = mockClient([], { message: "network down" });
    const result = await fetchInvestorRequests(client, ["inv-a"]);

    expect(result.failed).toBe(true);
    expect(result.requests).toEqual([]);
  });
});

describe("fetchRequestFilterOptions", () => {
  it("is scoped to the caller's investor ids", async () => {
    const { client, calls } = mockClient(ROWS);
    await fetchRequestFilterOptions(client, ["inv-a"]);

    expect(findCall(calls, "in", "investor_id")!.args[1]).toEqual(["inv-a"]);
  });

  it("offers only DESTINATION projects from this investor's own requests", async () => {
    const { client } = mockClient(ROWS);
    const { toProjectOptions } = await fetchRequestFilterOptions(client, ["inv-a"]);

    expect(toProjectOptions).toEqual([
      { id: "p2", name: "North Port Lote 7" },
      { id: "p3", name: "Punta Gorda Lote 9" },
    ]);
    // p1 is only ever an ORIGIN; it must not appear in a destination filter.
    expect(toProjectOptions.map((o) => o.id)).not.toContain("p1");
  });

  it("does not query at all without an investor link", async () => {
    const { client, tables } = mockClient(ROWS);
    const result = await fetchRequestFilterOptions(client, []);

    expect(tables).toEqual([]);
    expect(result.toProjectOptions).toEqual([]);
  });

  it("reports the total, which tells an empty screen from an empty filter", async () => {
    const { client } = mockClient(ROWS);
    expect((await fetchRequestFilterOptions(client, ["inv-a"])).total).toBe(3);

    const { client: none } = mockClient([]);
    expect((await fetchRequestFilterOptions(none, ["inv-a"])).total).toBe(0);
  });
});

describe("parseRequestFilters", () => {
  it("reads both filters from the URL", () => {
    expect(
      parseRequestFilters({
        [REQUEST_PARAMS.toProject]: "p2",
        [REQUEST_PARAMS.status]: "pendiente",
      })
    ).toEqual({ toProjectId: "p2", status: "pendiente" });
  });

  it("accepts every status the schema stores", () => {
    for (const status of REQUEST_STATUSES) {
      expect(
        parseRequestFilters({ [REQUEST_PARAMS.status]: status }).status
      ).toBe(status);
    }
  });

  it("drops an invented status so the table is not silently emptied", () => {
    expect(
      parseRequestFilters({ [REQUEST_PARAMS.status]: "cancelada" }).status
    ).toBeNull();
  });

  it("treats absent or blank params as no filter", () => {
    expect(parseRequestFilters({})).toEqual({
      toProjectId: null,
      status: null,
    });
    expect(
      parseRequestFilters({ [REQUEST_PARAMS.toProject]: "  " }).toProjectId
    ).toBeNull();
  });
});

describe("requestStatusVariant", () => {
  it("maps each state to its meaning", () => {
    expect(requestStatusVariant("aprobada")).toBe("success");
    expect(requestStatusVariant("pendiente")).toBe("warning");
    expect(requestStatusVariant("rechazada")).toBe("danger");
  });

  it("falls back to neutral for an unknown state, never to a meaningful colour", () => {
    expect(requestStatusVariant(null)).toBe("neutral");
    expect(requestStatusVariant("cancelada")).toBe("neutral");
    // Showing an unrecognised state in green would be a lie.
    expect(requestStatusVariant("cancelada")).not.toBe("success");
  });

  it("covers every status the schema allows", () => {
    for (const status of REQUEST_STATUSES) {
      expect(requestStatusVariant(status)).not.toBe("neutral");
      expect(es.requests.status[status], `missing label for "${status}"`).toBeTruthy();
    }
  });
});
