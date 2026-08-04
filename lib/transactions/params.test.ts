import { describe, expect, it } from "vitest";
import { TRANSACTION_PARAMS, parseTransactionFilters } from "./params";
import { TRANSACTION_TYPES, transactionDirection } from "./types";

describe("parseTransactionFilters", () => {
  it("reads both filters from the URL", () => {
    expect(
      parseTransactionFilters({
        [TRANSACTION_PARAMS.project]: "p1",
        [TRANSACTION_PARAMS.type]: "aporte",
      })
    ).toEqual({ projectId: "p1", type: "aporte" });
  });

  it("returns both empty when nothing is set", () => {
    expect(parseTransactionFilters({})).toEqual({ projectId: null, type: null });
  });

  it("accepts every type the schema stores", () => {
    for (const type of TRANSACTION_TYPES) {
      expect(
        parseTransactionFilters({ [TRANSACTION_PARAMS.type]: type }).type
      ).toBe(type);
    }
  });

  it("drops an invented type so the table is not silently emptied", () => {
    expect(
      parseTransactionFilters({ [TRANSACTION_PARAMS.type]: "inventado" }).type
    ).toBeNull();
  });

  it("takes the first value when a param is repeated", () => {
    expect(
      parseTransactionFilters({ [TRANSACTION_PARAMS.project]: ["p1", "p2"] })
        .projectId
    ).toBe("p1");
  });

  it("treats a blank param as absent", () => {
    expect(
      parseTransactionFilters({ [TRANSACTION_PARAMS.project]: "   " }).projectId
    ).toBeNull();
  });
});

describe("transactionDirection", () => {
  it("treats a contribution as capital going in", () => {
    expect(transactionDirection("aporte")).toBe("in");
  });

  it("treats yield and capital return as value coming back — but SEPARATELY", () => {
    expect(transactionDirection("rendimiento")).toBe("out");
    expect(transactionDirection("devolución de capital")).toBe("out");
    // They share a direction but remain distinct values; nothing merges them.
    expect(TRANSACTION_TYPES).toContain("rendimiento");
    expect(TRANSACTION_TYPES).toContain("devolución de capital");
  });

  it("treats a reassignment as neutral: it moves capital between own projects", () => {
    expect(transactionDirection("reasignación")).toBe("neutral");
  });

  it("does not guess for an unknown or missing type", () => {
    expect(transactionDirection(null)).toBe("neutral");
    expect(transactionDirection("otra cosa")).toBe("neutral");
  });
});
