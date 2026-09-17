import type { TableFilters } from "./filters";

/** The slice of a PostgREST builder this helper needs. */
export type OrderableQuery<T> = {
  order: (
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean }
  ) => T;
  eq: (column: string, value: string) => T;
  limit: (count: number) => T;
};

export type AdminQueryOptions = {
  /** Primary sort column. Defaults to created_at. */
  orderBy?: string;
  filters?: TableFilters;
  limit: number;
};

/**
 * Applies the ordering, the filters and the row cap of an editable table.
 *
 * THE ORDER IS THE POINT. Sorting by `created_at` alone leaves every row
 * created in the same batch — a seed, an import, anything written in one
 * transaction — tied, and Postgres may return tied rows in any order it likes.
 * It did: the panel reshuffled itself after every save, because each refetch is
 * a new plan and nothing said what should come first. Adding the id as the last
 * key makes the order TOTAL, so the same query always answers the same way.
 *
 * `nullsFirst: false` for the same reason: a table sorted by a column that is
 * often empty (report_month, requested_at) would otherwise open on its blanks.
 *
 * Generic over the builder so it can be tested without a Supabase client.
 */
export function applyAdminTableQuery<T extends OrderableQuery<T>>(
  query: T,
  { orderBy, filters = {}, limit }: AdminQueryOptions
): T {
  let result = query
    .order(orderBy ?? "created_at", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true })
    .limit(limit);

  for (const [column, value] of Object.entries(filters)) {
    result = result.eq(column, value);
  }

  return result;
}
