import { describe, expect, it } from "vitest";
import { applyAdminTableQuery, type OrderableQuery } from "./query";

type Call = { method: string; args: unknown[] };

/** Records what the query builder was asked to do, in order. */
function fakeQuery() {
  const calls: Call[] = [];
  const builder = {
    order(column: string, options?: unknown) {
      calls.push({ method: "order", args: [column, options] });
      return builder;
    },
    eq(column: string, value: string) {
      calls.push({ method: "eq", args: [column, value] });
      return builder;
    },
    limit(count: number) {
      calls.push({ method: "limit", args: [count] });
      return builder;
    },
  };
  return { builder: builder as OrderableQuery<typeof builder>, calls };
}

describe("applyAdminTableQuery", () => {
  it("always breaks ties with the id, so the order never shuffles", () => {
    const { builder, calls } = fakeQuery();

    applyAdminTableQuery(builder, { limit: 100 });

    expect(calls.filter((call) => call.method === "order")).toEqual([
      { method: "order", args: ["created_at", { ascending: true, nullsFirst: false }] },
      { method: "order", args: ["id", { ascending: true }] },
    ]);
  });

  it("keeps the table's own sort column as the primary key of the order", () => {
    const { builder, calls } = fakeQuery();

    applyAdminTableQuery(builder, { orderBy: "report_month", limit: 100 });

    const orders = calls.filter((call) => call.method === "order");
    expect(orders[0].args[0]).toBe("report_month");
    expect(orders[1].args[0]).toBe("id");
  });

  it("sends empty values to the end rather than opening the table on blanks", () => {
    const { builder, calls } = fakeQuery();

    applyAdminTableQuery(builder, { orderBy: "requested_at", limit: 100 });

    expect(calls[0].args[1]).toEqual({ ascending: true, nullsFirst: false });
  });

  it("narrows by every active filter", () => {
    const { builder, calls } = fakeQuery();

    applyAdminTableQuery(builder, {
      limit: 100,
      filters: { status: "activo", city: "Rotonda" },
    });

    expect(calls.filter((call) => call.method === "eq")).toEqual([
      { method: "eq", args: ["status", "activo"] },
      { method: "eq", args: ["city", "Rotonda"] },
    ]);
  });

  it("caps the rows even when nothing is filtered", () => {
    const { builder, calls } = fakeQuery();

    applyAdminTableQuery(builder, { limit: 100 });

    expect(calls).toContainEqual({ method: "limit", args: [100] });
  });
});
