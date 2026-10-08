import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateRow } from "@/lib/table/validation";
import { ADMIN_TABLES, findAdminTable } from "./table-definitions";

const MIGRATIONS = path.resolve(__dirname, "../../../supabase/migrations");

/**
 * The whitelist inside `admin_save_table_changes`, read from the LAST
 * migration that defines it.
 *
 * Why a test reads SQL: a tab whose table is not on that list looks perfectly
 * fine until someone tries to save, and then the database refuses it. That is
 * exactly how the Transacciones tab was missing — the screen existed nowhere,
 * but the same mistake in reverse (a tab the function will not accept) is one
 * edit away.
 */
function allowedTables(): string[] {
  const files = fs
    .readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  let list: string[] = [];
  for (const name of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS, name), "utf8");
    const match = sql.match(/allowed_tables constant text\[\]\s*:=\s*array\[([\s\S]*?)\]/);
    if (match) {
      list = [...match[1].matchAll(/'([a-z_]+)'/g)].map((entry) => entry[1]);
    }
  }
  return list;
}

describe("every tab can actually be saved", () => {
  it("has its table on the whitelist of admin_save_table_changes", () => {
    const allowed = allowedTables();

    expect(allowed.length).toBeGreaterThan(0);
    for (const table of ADMIN_TABLES) {
      expect(allowed, `la pestaña "${table.label}" escribe en ${table.source}`).toContain(
        table.source
      );
    }
  });
});

describe("the Transacciones tab", () => {
  const tab = findAdminTable("transacciones");

  it("exists and points at the transactions table", () => {
    expect(tab.id).toBe("transacciones");
    expect(tab.source).toBe("transactions");
  });

  it("asks for what a movement needs: who, where, when, what and how much", () => {
    const keys = tab.columns.map((column) => column.key);
    expect(keys).toEqual(
      expect.arrayContaining(["investor_id", "project_id", "date", "type", "amount"])
    );
  });

  it("requires the investor, the project, the type and the amount", () => {
    const required = tab.columns.filter((column) => column.required).map((c) => c.key);
    expect(required).toEqual(
      expect.arrayContaining(["investor_id", "project_id", "type", "amount"])
    );
  });

  it("offers only the movements an admin records by hand", () => {
    const type = tab.columns.find((column) => column.key === "type");
    // 'reasignación' is NOT offered: it is created by approving a request, and
    // typing one by hand would double-count the capital that moved.
    expect(type?.options).toEqual(["aporte", "rendimiento", "devolución de capital"]);
  });

  it("accepts a well-formed movement", () => {
    const result = validateRow(
      tab.columns,
      {
        investor_id: "11111111-1111-4111-8111-111111111111",
        project_id: "22222222-2222-4222-8222-222222222222",
        date: "2026-10-08",
        type: "aporte",
        amount: "15000",
        capital_type: "equity",
      },
      "insert"
    );

    expect(result.ok).toBe(true);
  });

  it("refuses a negative amount: amounts are always positive, the type says the direction", () => {
    const result = validateRow(
      tab.columns,
      {
        investor_id: "11111111-1111-4111-8111-111111111111",
        project_id: "22222222-2222-4222-8222-222222222222",
        date: "2026-10-08",
        type: "rendimiento",
        amount: "-500",
      },
      "insert"
    );

    expect(result.ok).toBe(false);
  });

  it("refuses a movement with no investor: it would belong to nobody", () => {
    const result = validateRow(
      tab.columns,
      { project_id: "22222222-2222-4222-8222-222222222222", type: "aporte", amount: "100" },
      "insert"
    );

    expect(result.ok).toBe(false);
  });

  it("refuses a type outside the schema's CHECK", () => {
    const result = validateRow(tab.columns, { type: "regalo" }, "update");

    expect(result.ok).toBe(false);
  });
});
