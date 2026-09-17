import { describe, expect, it } from "vitest";
import type { TableColumn } from "./types";
import {
  filterParamName,
  filterableColumns,
  hasActiveTableFilters,
  parseTableFilters,
} from "./filters";

const columns: TableColumn[] = [
  { key: "name", label: "Nombre", type: "text" },
  { key: "status", label: "Estado", type: "select", options: ["activo", "pausado"] },
  { key: "city", label: "Ciudad", type: "select", options: ["Rotonda", "Otra"] },
  // A reference column: options arrive from the database.
  {
    key: "project_id",
    label: "Proyecto",
    type: "select",
    options: [{ value: "p-1", label: "Casa Norte" }],
  },
  // Dynamically populated but still empty: nothing to choose from.
  { key: "investor_id", label: "Inversionista", type: "select", options: [] },
  { key: "amount", label: "Monto", type: "currency" },
];

describe("filterableColumns", () => {
  it("offers only select columns that have options", () => {
    expect(filterableColumns(columns).map((column) => column.key)).toEqual([
      "status",
      "city",
      "project_id",
    ]);
  });

  it("caps how many filters a bar shows", () => {
    expect(filterableColumns(columns, 2).map((column) => column.key)).toEqual([
      "status",
      "city",
    ]);
  });
});

describe("parseTableFilters", () => {
  it("reads the active filters from the search params", () => {
    expect(
      parseTableFilters(columns, { f_status: "activo", f_project_id: "p-1" })
    ).toEqual({ status: "activo", project_id: "p-1" });
  });

  it("drops a value that is not one of the column's options", () => {
    expect(parseTableFilters(columns, { f_status: "inventado" })).toEqual({});
  });

  it("ignores params that do not name a filterable column", () => {
    expect(
      parseTableFilters(columns, { tabla: "proyectos", f_name: "Casa" })
    ).toEqual({});
  });

  it("takes the first value when a param repeats", () => {
    expect(parseTableFilters(columns, { f_city: ["Rotonda", "Otra"] })).toEqual({
      city: "Rotonda",
    });
  });
});

describe("filterParamName", () => {
  it("prefixes the column key so it cannot collide with ?tabla=", () => {
    expect(filterParamName("status")).toBe("f_status");
  });
});

describe("hasActiveTableFilters", () => {
  it("is false when nothing is selected", () => {
    expect(hasActiveTableFilters({})).toBe(false);
    expect(hasActiveTableFilters({ status: "activo" })).toBe(true);
  });
});
