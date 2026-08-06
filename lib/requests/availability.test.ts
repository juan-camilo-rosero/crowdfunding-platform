import { describe, expect, it } from "vitest";
import {
  INELIGIBLE_DESTINATION_STATUSES,
  getAvailableForProject,
  getReassignablePositions,
  getReassignmentDestinations,
  subtractPendingClaims,
  type AvailabilityClient,
} from "./availability";
import {
  createRequestSchema,
  exceedsAvailable,
  validateCreateRequest,
} from "./create-schema";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

type Call = { table: string; method: string; args: unknown[] };

/** Chainable mock that answers per table. */
function mockClient(
  byTable: Record<string, { data?: unknown[]; error?: unknown }>
) {
  const calls: Call[] = [];

  const client = {
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq", "in", "not", "gt"]) {
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
  } as unknown as AvailabilityClient;

  return { client, calls };
}

const POSITIONS = [
  { project_id: "p1", current_capital: "10000" },
  { project_id: "p2", current_capital: "5000" },
];
const PROJECTS = [
  { id: "p1", name: "Villa Rotonda 118" },
  { id: "p2", name: "North Port Lote 7" },
];

describe("subtractPendingClaims — the isolated scope decision", () => {
  it("removes what pending requests already claim from each source", () => {
    const result = subtractPendingClaims(
      new Map([["p1", 10000]]),
      new Map([["p1", 4000]])
    );
    expect(result.get("p1")).toBe(6000);
  });

  it("leaves a source untouched when it has no pending claims", () => {
    const result = subtractPendingClaims(new Map([["p1", 10000]]), new Map());
    expect(result.get("p1")).toBe(10000);
  });

  it("can take a source to zero when pending claims consume it all", () => {
    const result = subtractPendingClaims(
      new Map([["p1", 10000]]),
      new Map([["p1", 10000]])
    );
    expect(result.get("p1")).toBe(0);
  });
});

describe("getReassignablePositions", () => {
  it("is scoped to the caller's investor ids", async () => {
    const { client, calls } = mockClient({
      investor_project_position: { data: POSITIONS },
      reassignment_requests: { data: [] },
      projects: { data: PROJECTS },
    });
    await getReassignablePositions(client, ["inv-a"]);

    const scope = calls.find(
      (c) => c.table === "investor_project_position" && c.method === "in"
    );
    expect(scope!.args).toEqual(["investor_id", ["inv-a"]]);
  });

  it("only considers positions with capital still working", async () => {
    const { client, calls } = mockClient({
      investor_project_position: { data: POSITIONS },
      reassignment_requests: { data: [] },
      projects: { data: PROJECTS },
    });
    await getReassignablePositions(client, ["inv-a"]);

    const gt = calls.find(
      (c) => c.table === "investor_project_position" && c.method === "gt"
    );
    expect(gt!.args).toEqual(["current_capital", 0]);
  });

  it("subtracts pending requests from the matching source", async () => {
    const { client } = mockClient({
      investor_project_position: { data: POSITIONS },
      reassignment_requests: {
        data: [{ from_project_id: "p1", amount: "4000" }],
      },
      projects: { data: PROJECTS },
    });
    const { sources } = await getReassignablePositions(client, ["inv-a"]);

    expect(sources.find((s) => s.projectId === "p1")!.availableAmount).toBe(6000);
    // p2 has no pending claim and keeps its full capital.
    expect(sources.find((s) => s.projectId === "p2")!.availableAmount).toBe(5000);
  });

  it("only counts PENDING requests, and only those leaving that source", async () => {
    const { client, calls } = mockClient({
      investor_project_position: { data: POSITIONS },
      reassignment_requests: { data: [] },
      projects: { data: PROJECTS },
    });
    await getReassignablePositions(client, ["inv-a"]);

    const statusFilter = calls.find(
      (c) => c.table === "reassignment_requests" && c.method === "eq"
    );
    expect(statusFilter!.args).toEqual(["status", "pendiente"]);
  });

  it("drops a source fully consumed by pending requests", async () => {
    const { client } = mockClient({
      investor_project_position: { data: [POSITIONS[0]] },
      reassignment_requests: {
        data: [{ from_project_id: "p1", amount: "10000" }],
      },
      projects: { data: PROJECTS },
    });
    const { sources } = await getReassignablePositions(client, ["inv-a"]);

    expect(sources).toEqual([]);
  });

  it("never queries without a scope", async () => {
    const { client, calls } = mockClient({});
    const result = await getReassignablePositions(client, []);

    expect(calls).toEqual([]);
    expect(result.sources).toEqual([]);
  });

  it("reports failure instead of pretending there is no capital", async () => {
    const { client } = mockClient({
      investor_project_position: { error: { message: "down" } },
    });
    const result = await getReassignablePositions(client, ["inv-a"]);

    expect(result.failed).toBe(true);
    expect(result.sources).toEqual([]);
  });
});

describe("getReassignmentDestinations", () => {
  it("excludes sold and rented projects", async () => {
    const { client, calls } = mockClient({ projects: { data: PROJECTS } });
    await getReassignmentDestinations(client);

    const filter = calls.find((c) => c.method === "not");
    expect(filter!.args[0]).toBe("status");
    expect(filter!.args[1]).toBe("in");
    for (const status of INELIGIBLE_DESTINATION_STATUSES) {
      expect(String(filter!.args[2])).toContain(status);
    }
  });
});

describe("getAvailableForProject — the number the server enforces", () => {
  it("returns the available amount for one source", async () => {
    const { client } = mockClient({
      investor_project_position: { data: POSITIONS },
      reassignment_requests: {
        data: [{ from_project_id: "p1", amount: "4000" }],
      },
      projects: { data: PROJECTS },
    });

    expect(await getAvailableForProject(client, ["inv-a"], "p1")).toBe(6000);
  });

  it("returns 0 for a project the investor holds nothing in", async () => {
    const { client } = mockClient({
      investor_project_position: { data: POSITIONS },
      reassignment_requests: { data: [] },
      projects: { data: PROJECTS },
    });

    expect(await getAvailableForProject(client, ["inv-a"], "someone-elses")).toBe(0);
  });

  it("returns null on failure so the caller does not read it as zero", async () => {
    const { client } = mockClient({
      investor_project_position: { error: { message: "down" } },
    });

    expect(await getAvailableForProject(client, ["inv-a"], "p1")).toBeNull();
  });
});

describe("createRequestSchema", () => {
  const valid = { fromProjectId: UUID_A, toProjectId: UUID_B, amount: 1000 };

  it("accepts a well-formed payload", () => {
    expect(createRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a zero or negative amount", () => {
    expect(validateCreateRequest({ ...valid, amount: 0 }).success).toBe(false);
    expect(validateCreateRequest({ ...valid, amount: -5 }).success).toBe(false);
  });

  it("rejects an amount that is not a number", () => {
    expect(validateCreateRequest({ ...valid, amount: Number.NaN }).success).toBe(false);
    expect(validateCreateRequest({ ...valid, amount: "1000" }).success).toBe(false);
  });

  it("rejects origin equal to destination", () => {
    const result = validateCreateRequest({ ...valid, toProjectId: UUID_A });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.toProjectId).toBeTruthy();
  });

  it("rejects ids that are not uuids", () => {
    expect(validateCreateRequest({ ...valid, fromProjectId: "p1" }).success).toBe(false);
    expect(validateCreateRequest({ ...valid, toProjectId: "" }).success).toBe(false);
  });

  it("carries no investor_id or status: neither is the client's to choose", () => {
    const result = validateCreateRequest({
      ...valid,
      investor_id: "someone-else",
      status: "aprobada",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("investor_id");
      expect(result.data).not.toHaveProperty("status");
    }
  });
});

describe("exceedsAvailable — the ceiling", () => {
  it("allows exactly the available amount", () => {
    expect(exceedsAvailable(6000, 6000)).toBe(false);
  });

  it("rejects a single unit above it", () => {
    expect(exceedsAvailable(6000.01, 6000)).toBe(true);
    expect(exceedsAvailable(6001, 6000)).toBe(true);
  });

  it("allows anything under it", () => {
    expect(exceedsAvailable(1, 6000)).toBe(false);
  });
});
