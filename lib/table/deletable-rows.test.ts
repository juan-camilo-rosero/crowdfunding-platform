import { describe, expect, it } from "vitest";
import { es } from "@/i18n";
import { DELETABLE_TABLES, whyRowCannotBeDeleted } from "./deletable-rows";

describe("which tables allow deleting a row", () => {
  it("allows the records that nothing else hangs off", () => {
    for (const table of [
      "transactions",
      "budget_items",
      "tasks",
      "monthly_reports",
      "documents",
      "investment_interests",
      "capital_contributions",
      "reassignment_requests",
    ]) {
      expect(DELETABLE_TABLES).toContain(table);
    }
  });

  it("NEVER allows projects or investors", () => {
    // Deleting a project cascades into its budget, tasks and reports; deleting
    // an investor cascades into their tickets and signatures, and the database
    // refuses it outright when they hold money. Neither belongs behind a bin
    // icon in a table.
    expect(DELETABLE_TABLES).not.toContain("projects");
    expect(DELETABLE_TABLES).not.toContain("investors");
    expect(DELETABLE_TABLES).not.toContain("users");
  });
});

describe("whyRowCannotBeDeleted", () => {
  it("allows a plain row of a deletable table", () => {
    expect(whyRowCannotBeDeleted("transactions", { id: "t1", amount: 100 })).toBeNull();
  });

  it("refuses any row of a table that is not deletable", () => {
    expect(whyRowCannotBeDeleted("projects", { id: "p1" })).toBe(
      es.admin.delete.tableNotAllowed
    );
  });

  it("refuses an APPROVED reassignment: its capital already moved", () => {
    // The approved request is what investor_project_position reads to move
    // capital between projects, and approving it created a transaction too.
    // Deleting it would move the money back silently.
    expect(
      whyRowCannotBeDeleted("reassignment_requests", { id: "r1", status: "aprobada" })
    ).toBe(es.admin.delete.approvedRequest);
  });

  it("allows a pending or rejected reassignment", () => {
    for (const status of ["pendiente", "rechazada"]) {
      expect(whyRowCannotBeDeleted("reassignment_requests", { id: "r1", status })).toBeNull();
    }
  });

  it("refuses a row with no id: there is nothing to address", () => {
    expect(whyRowCannotBeDeleted("transactions", {})).toBe(es.admin.delete.noId);
  });
});
