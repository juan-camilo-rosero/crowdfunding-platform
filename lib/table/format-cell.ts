import { formatCurrency, formatDate, formatPercent, formatPhone } from "@/lib/format";
import type { ColumnDataType } from "./column-types";
import type { TableColumn } from "./types";

/** Read-mode text for a cell. Empty string renders as a blank cell. */
export function formatCellValue(
  value: unknown,
  type: ColumnDataType
): string {
  if (value === null || value === undefined || value === "") return "";

  switch (type) {
    case "currency":
      return formatCurrency(Number(value));
    case "percent":
      return formatPercent(Number(value));
    case "date":
      return formatDate(String(value));
    case "boolean":
      return value ? "Sí" : "No";
    case "phone":
      return formatPhone(String(value));
    default:
      return String(value);
  }
}

/**
 * Value handed to the edit control. Dates need the raw ISO day for
 * `<input type="date">`, and money/percent the plain number.
 */
export function toEditableValue(value: unknown, type: ColumnDataType): string {
  if (value === null || value === undefined) return "";
  if (type === "date") return String(value).slice(0, 10);
  return String(value);
}

/** Default column width in px when the definition does not set one. */
export function defaultColumnWidth(type: ColumnDataType): number {
  switch (type) {
    case "longText":
      return 320;
    case "email":
    case "url":
      return 240;
    case "text":
    case "select":
      return 200;
    case "phone":
      return 160;
    case "currency":
      return 150;
    // A formatted date is "27 mar 2026": ~95px of glyphs plus the 25px inline
    // padding on both sides. At 150 it landed a hair short and wrapped onto a
    // second line, which reads as broken rather than tight.
    case "date":
      return 175;
    case "number":
    case "percent":
    case "boolean":
      return 120;
    default:
      return 180;
  }
}

/**
 * A column is never narrower than its own header, otherwise the label clips.
 * Poppins medium at 16px averages ~8.6px per glyph; the constant covers the
 * type icon, its gap and the 25px inline padding on both sides.
 */
function headerMinWidth(label: string): number {
  return Math.ceil(label.length * 8.6) + 16 + 8 + 50;
}

/** Final rendered width for a column, in px. */
export function resolveColumnWidth(column: TableColumn): number {
  const base = column.width ?? defaultColumnWidth(column.type);
  return Math.max(base, headerMinWidth(column.label));
}
