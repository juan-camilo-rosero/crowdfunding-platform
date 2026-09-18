import { formatCellValue } from "./format-cell";
import { optionLabel, optionValue, type TableColumn } from "./types";

/** Between the parts of a subtitle: "Rotonda · casa". */
export const SUBTITLE_SEPARATOR = " · ";

/**
 * The second line of a two-line cell, built from OTHER fields of the record.
 *
 * `readValue` is how a field is read, not the raw row: the grid passes the
 * value currently on screen — a local edit included — so changing a project's
 * city in its own column updates the line under its name at once, instead of
 * showing the old city until the server answers.
 *
 * Each part is formatted the way its own column would show it (a reference as
 * the record's name rather than its id, money as money). A key that is not a
 * column of the table — the email in the sales funnel, which does not show that
 * column — is read as plain text.
 *
 * Empty parts are dropped rather than leaving a dangling "Rotonda · ", and a
 * part repeated verbatim is shown once. When nothing is left, the answer is ""
 * and the cell falls back to a single line.
 */
export function buildSubtitle(
  keys: readonly string[] | undefined,
  readValue: (key: string) => unknown,
  columns: readonly TableColumn[]
): string {
  if (!keys || keys.length === 0) return "";

  const byKey = new Map(columns.map((column) => [column.key, column]));
  const parts: string[] = [];

  for (const key of keys) {
    const value = readValue(key);
    if (value === null || value === undefined) continue;

    const column = byKey.get(key);
    let text: string;

    if (column?.type === "select" && column.options) {
      const match = column.options.find(
        (option) => optionValue(option) === String(value)
      );
      text = match ? optionLabel(match) : String(value);
    } else if (column) {
      text = formatCellValue(value, column.type);
    } else {
      text = String(value);
    }

    text = text.trim();
    if (text && !parts.includes(text)) parts.push(text);
  }

  return parts.join(SUBTITLE_SEPARATOR);
}
