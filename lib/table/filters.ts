import { optionValue, type TableColumn } from "./types";

/**
 * Filters for the editable tables, derived from the column definitions.
 *
 * The investor screens filter through the URL (see ProjectFilterBar): the
 * search params ARE the state, so a filtered table survives a reload, a back
 * button and a share. The admin panel now does the same, and for the same
 * reason — plus one of its own: the panel re-queries on every autosave, and a
 * filter held in component state would be re-applied on the client over rows
 * the server had already narrowed differently.
 *
 * Nothing here is table-specific: a `select` column with options is filterable,
 * anything else is not.
 */

/** Prefix that keeps a filter param from colliding with `?tabla=` or `?etapa=`. */
export const TABLE_FILTER_PREFIX = "f_";

/**
 * How many filters a bar may show. Beyond four the row wraps into a block that
 * competes with the table for attention; the rest of the columns are still
 * reachable by scrolling the grid.
 */
export const MAX_TABLE_FILTERS = 4;

export function filterParamName(columnKey: string): string {
  return `${TABLE_FILTER_PREFIX}${columnKey}`;
}

/**
 * Columns a filter can be offered for, in the order they appear in the table.
 *
 * Reference columns (project_id, investor_id) are included: their options are
 * filled in from the database before this runs, and "show me only this
 * project's budget lines" is the single most useful filter in the panel.
 */
export function filterableColumns(
  columns: TableColumn[],
  max: number = MAX_TABLE_FILTERS
): TableColumn[] {
  return columns
    .filter(
      (column) =>
        column.type === "select" &&
        Array.isArray(column.options) &&
        column.options.length > 0
    )
    .slice(0, max);
}

export type TableFilters = Record<string, string>;

/**
 * Reads the active filters out of the search params.
 *
 * A value that is not one of the column's own options is DROPPED rather than
 * passed to the query: it would have narrowed the table to nothing with no way
 * to tell why, and it is the one thing a hand-typed URL can inject here.
 */
export function parseTableFilters(
  columns: TableColumn[],
  searchParams: Record<string, string | string[] | undefined>
): TableFilters {
  const filters: TableFilters = {};

  for (const column of filterableColumns(columns)) {
    const raw = searchParams[filterParamName(column.key)];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (!value) continue;

    const allowed = (column.options ?? []).map(optionValue);
    if (allowed.includes(value)) filters[column.key] = value;
  }

  return filters;
}

export function hasActiveTableFilters(filters: TableFilters): boolean {
  return Object.keys(filters).length > 0;
}
