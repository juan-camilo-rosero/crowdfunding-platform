import { describe, expect, it } from "vitest";
import { serializeReturnOffer, type ReturnOffer } from "@/lib/projects/return-offer";
import { formatCellValue, toEditableValue } from "./format-cell";
import { withRetiredLegacyReturn } from "./legacy-return";
import type { TableColumn } from "./types";
import { validateRow } from "./validation";

/**
 * The `returnOffer` column type through the generic table layer: how the grid
 * reads it, what the editor starts from, and what the server accepts.
 */

const COLUMNS: TableColumn[] = [
  { key: "name", label: "Nombre", type: "text" },
  { key: "return_offer", label: "Retorno ofrecido", type: "returnOffer" },
];

const OFFER: ReturnOffer = { kind: "total", min: 18, max: 22, months: 18 };

describe("formatCellValue", () => {
  it("shows the offer's label, from the stored object", () => {
    expect(formatCellValue(OFFER, "returnOffer")).toBe("18%–22% al cierre · 18 meses");
  });

  it("shows the label from the JSON string an edit leaves behind", () => {
    expect(formatCellValue(JSON.stringify(OFFER), "returnOffer")).toBe(
      "18%–22% al cierre · 18 meses"
    );
  });

  it("never shows '[object Object]' or raw JSON for something unreadable", () => {
    expect(formatCellValue({ kind: "otro" }, "returnOffer")).toBe("");
    expect(formatCellValue("{roto", "returnOffer")).toBe("");
  });
});

describe("toEditableValue", () => {
  it("hands the editor the canonical JSON, never '[object Object]'", () => {
    expect(toEditableValue(OFFER, "returnOffer")).toBe(serializeReturnOffer(OFFER));
  });

  it("is empty for no offer", () => {
    expect(toEditableValue(null, "returnOffer")).toBe("");
  });
});

describe("validateRow", () => {
  it("stores a valid offer in its canonical form", () => {
    const shuffled = JSON.stringify({ months: 18, max: 22, min: 18, kind: "total" });

    expect(validateRow(COLUMNS, { return_offer: shuffled }, "update")).toEqual({
      ok: true,
      values: { return_offer: serializeReturnOffer(OFFER) },
    });
  });

  it("refuses an offer that is not valid, with the reason", () => {
    const result = validateRow(
      COLUMNS,
      { return_offer: JSON.stringify({ kind: "total", min: 30, max: 10, months: null }) },
      "update"
    );
    expect(result.ok).toBe(false);
  });

  it("refuses free text in the structured column", () => {
    expect(validateRow(COLUMNS, { return_offer: "15% anual" }, "update").ok).toBe(false);
  });

  it("clears the offer when the value is empty", () => {
    expect(validateRow(COLUMNS, { return_offer: "" }, "update")).toEqual({
      ok: true,
      values: { return_offer: null },
    });
  });
});

describe("withRetiredLegacyReturn", () => {
  it("clears the legacy text whenever the offer is written", () => {
    expect(
      withRetiredLegacyReturn("projects", { return_offer: serializeReturnOffer(OFFER) })
    ).toEqual({ return_offer: serializeReturnOffer(OFFER), offered_return: null });
  });

  it("also when the offer is being cleared", () => {
    expect(withRetiredLegacyReturn("projects", { return_offer: null })).toEqual({
      return_offer: null,
      offered_return: null,
    });
  });

  it("leaves a write that does not touch the offer alone", () => {
    expect(withRetiredLegacyReturn("projects", { name: "Casa" })).toEqual({ name: "Casa" });
  });

  it("only applies to projects", () => {
    expect(withRetiredLegacyReturn("investors", { return_offer: null })).toEqual({
      return_offer: null,
    });
  });
});
