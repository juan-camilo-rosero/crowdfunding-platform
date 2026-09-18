import { describe, expect, it } from "vitest";
import { parseBoolean } from "./boolean";
import { formatCellValue } from "./format-cell";

/**
 * A boolean reaches a cell in two shapes: a real boolean from the database,
 * and the STRING "true"/"false" that the grid keeps for a local edit (every
 * committed value is a string). Treating the string as truthy is exactly the
 * bug that made "En captación" look impossible to switch off.
 */
describe("parseBoolean", () => {
  it("reads real booleans", () => {
    expect(parseBoolean(true)).toBe(true);
    expect(parseBoolean(false)).toBe(false);
  });

  it("reads the strings the grid stores for an edit", () => {
    expect(parseBoolean("true")).toBe(true);
    expect(parseBoolean("false")).toBe(false);
  });

  it("does not let the string 'false' count as true", () => {
    expect(parseBoolean("false")).not.toBe(true);
  });

  it("tolerates case and surrounding spaces", () => {
    expect(parseBoolean(" TRUE ")).toBe(true);
    expect(parseBoolean("False")).toBe(false);
  });

  it("is null — unknown, not false — for anything else", () => {
    expect(parseBoolean(null)).toBeNull();
    expect(parseBoolean(undefined)).toBeNull();
    expect(parseBoolean("")).toBeNull();
    expect(parseBoolean("sí")).toBeNull();
    expect(parseBoolean(1)).toBeNull();
  });
});

describe("formatCellValue for booleans", () => {
  it("says No for the string 'false' (the regression)", () => {
    expect(formatCellValue("false", "boolean")).toBe("No");
  });

  it("says Sí for true in either shape", () => {
    expect(formatCellValue(true, "boolean")).toBe("Sí");
    expect(formatCellValue("true", "boolean")).toBe("Sí");
  });

  it("says No for a real false", () => {
    expect(formatCellValue(false, "boolean")).toBe("No");
  });

  it("stays blank for an unset value", () => {
    expect(formatCellValue(null, "boolean")).toBe("");
    expect(formatCellValue("basura", "boolean")).toBe("");
  });
});
