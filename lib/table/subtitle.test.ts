import { describe, expect, it } from "vitest";
import type { TableColumn, TableRow } from "./types";
import { SUBTITLE_SEPARATOR, buildSubtitle } from "./subtitle";

const COLUMNS: TableColumn[] = [
  { key: "name", label: "Nombre", type: "text" },
  { key: "city", label: "Ciudad", type: "select", options: ["Rotonda", "Otra"] },
  { key: "type", label: "Tipo", type: "select", options: ["casa", "lote"] },
  {
    key: "project_id",
    label: "Proyecto",
    type: "select",
    options: [{ value: "p-1", label: "Villa Rotonda" }],
  },
  { key: "amount", label: "Monto", type: "currency" },
];

const read = (row: TableRow) => (key: string) => row[key];

describe("buildSubtitle", () => {
  it("joins the parts with a middle dot", () => {
    expect(
      buildSubtitle(["city", "type"], read({ city: "Rotonda", type: "casa" }), COLUMNS)
    ).toBe(`Rotonda${SUBTITLE_SEPARATOR}casa`);
  });

  it("drops an empty part instead of leaving a dangling separator", () => {
    expect(
      buildSubtitle(["city", "type"], read({ city: "Rotonda", type: null }), COLUMNS)
    ).toBe("Rotonda");
    expect(
      buildSubtitle(["city", "type"], read({ city: "", type: "casa" }), COLUMNS)
    ).toBe("casa");
  });

  it("treats whitespace as empty", () => {
    expect(buildSubtitle(["city"], read({ city: "   " }), COLUMNS)).toBe("");
  });

  it("is empty when every part is, so the cell stays on one line", () => {
    expect(buildSubtitle(["city", "type"], read({}), COLUMNS)).toBe("");
  });

  it("is empty when the column declares no subtitle", () => {
    expect(buildSubtitle(undefined, read({ city: "Rotonda" }), COLUMNS)).toBe("");
    expect(buildSubtitle([], read({ city: "Rotonda" }), COLUMNS)).toBe("");
  });

  it("shows a reference by its name, never by its id", () => {
    expect(buildSubtitle(["project_id"], read({ project_id: "p-1" }), COLUMNS)).toBe(
      "Villa Rotonda"
    );
  });

  it("falls back to the stored value for a reference it cannot resolve", () => {
    expect(buildSubtitle(["project_id"], read({ project_id: "p-9" }), COLUMNS)).toBe(
      "p-9"
    );
  });

  it("formats a part the way its own column would", () => {
    expect(buildSubtitle(["amount"], read({ amount: 140926 }), COLUMNS)).toBe(
      "$140,926"
    );
  });

  it("reads a field the table does not show as plain text", () => {
    // The sales funnel has no email column, but the row carries it.
    expect(
      buildSubtitle(["email"], read({ email: "ana@ejemplo.com" }), COLUMNS)
    ).toBe("ana@ejemplo.com");
  });

  it("shows a repeated part once", () => {
    expect(
      buildSubtitle(["city", "type"], read({ city: "Otra", type: "Otra" }), COLUMNS)
    ).toBe("Otra");
  });

  it("reads through the accessor, so an edit on screen shows before it is saved", () => {
    const saved = { city: "Rotonda", type: "casa" };
    const onScreen = (key: string) => (key === "city" ? "Otra" : saved[key as "type"]);

    expect(buildSubtitle(["city", "type"], onScreen, COLUMNS)).toBe(
      `Otra${SUBTITLE_SEPARATOR}casa`
    );
  });

  it("keeps a numeric zero, which is a value and not an absence", () => {
    expect(buildSubtitle(["amount"], read({ amount: 0 }), COLUMNS)).toBe("$0");
  });
});
