import { z } from "zod";
import { es } from "@/i18n";
import { optionValue, type TableColumn } from "./types";

/**
 * Validation derived from the column definitions — one place for every table.
 *
 * Nothing here is table-specific: a column's `type`, `required`, `readOnly` and
 * `options` are enough to know how its value must look. Adding a table to the
 * admin panel therefore needs no new validation code.
 *
 * This runs on the SERVER before anything is written; the client never gets to
 * decide what is valid.
 */

function message(template: string, label: string): string {
  return template.replace("{campo}", label);
}

/** Values arrive from the table as strings; "" means "no value". */
function isBlank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim() === "";
}

function validateValue(column: TableColumn, raw: string): string | null {
  const label = column.label;
  const value = raw.trim();

  switch (column.type) {
    case "number":
    case "currency":
    case "percent": {
      if (!Number.isFinite(Number(value))) {
        return message(es.validation.invalidNumber, label);
      }
      const numeric = Number(value);
      if (column.type !== "number" && numeric < 0) {
        return message(es.validation.negativeAmount, label);
      }
      if (column.type === "percent" && (numeric < 0 || numeric > 100)) {
        return message(es.validation.percentRange, label);
      }
      return null;
    }

    case "date": {
      // Reject "2026-13-45"-style strings, which Date happily shifts.
      if (!/^\d{4}-\d{2}-\d{2}/.test(value)) {
        return message(es.validation.invalidDate, label);
      }
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return message(es.validation.invalidDate, label);
      }
      const [year, month, day] = value.slice(0, 10).split("-").map(Number);
      if (
        parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() + 1 !== month ||
        parsed.getUTCDate() !== day
      ) {
        return message(es.validation.invalidDate, label);
      }
      return null;
    }

    case "email":
      return z.email().safeParse(value).success
        ? null
        : message(es.validation.invalidEmail, label);

    case "url":
      return z.url().safeParse(value).success
        ? null
        : message(es.validation.invalidUrl, label);

    case "boolean":
      return value === "true" || value === "false"
        ? null
        : message(es.validation.invalidBoolean, label);

    case "select": {
      // The CHECK constraints in the schema are the source of truth; the
      // options list mirrors them.
      if (!column.options) {
        // Skip validation for dynamically populated selects (like project_id).
        // The database foreign key will catch any invalid values.
        return null;
      }
      const allowed = column.options.map(optionValue);
      return allowed.includes(value)
        ? null
        : message(es.validation.invalidOption, label);
    }

    default:
      return null;
  }
}

export type ValidationResult =
  | { ok: true; values: Record<string, string | null> }
  | { ok: false; error: string };

/**
 * Validates one record's worth of values.
 *
 * @param columns  Definition of the table being written.
 * @param values   Raw cell values keyed by column.
 * @param mode     "insert" also enforces `required`; "update" only checks the
 *                 fields actually touched.
 */
export function validateRow(
  columns: TableColumn[],
  values: Record<string, string>,
  mode: "insert" | "update"
): ValidationResult {
  const byKey = new Map(columns.map((column) => [column.key, column]));
  const clean: Record<string, string | null> = {};

  for (const [key, raw] of Object.entries(values)) {
    const column = byKey.get(key);

    // Unknown or read-only columns are refused rather than silently dropped, so
    // a crafted payload gets a clear answer instead of a partial write.
    if (!column) {
      return { ok: false, error: message(es.validation.invalidOption, key) };
    }
    if (column.readOnly) {
      return { ok: false, error: message(es.validation.readOnly, column.label) };
    }

    if (isBlank(raw)) {
      clean[key] = null;
      continue;
    }

    const error = validateValue(column, raw);
    if (error) return { ok: false, error };
    clean[key] = raw.trim();
  }

  if (mode === "insert") {
    for (const column of columns) {
      if (!column.required) continue;
      if (isBlank(clean[column.key] ?? undefined)) {
        return {
          ok: false,
          error: message(es.validation.required, column.label),
        };
      }
    }
  }

  return { ok: true, values: clean };
}
