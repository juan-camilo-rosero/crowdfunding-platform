import type { TransactionFilters } from "./types";
import { isTransactionType } from "./types";

/**
 * URL spelling of the /transacciones filters. Spanish keys, like the routes
 * themselves, because they are part of a user-visible URL (CLAUDE.md).
 */
export const TRANSACTION_PARAMS = {
  project: "proyecto",
  type: "movimiento",
} as const;

function firstValue(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.trim() ? value.trim() : null;
}

/**
 * Reads the filters out of the URL.
 *
 * An unknown movement type is dropped rather than kept: a hand-edited URL shows
 * the whole history instead of an empty table that looks like a bug. The
 * project id is NOT validated here — it does not need to be. The query scopes
 * to the caller's own investor rows first, so an id belonging to someone else's
 * project simply matches nothing.
 */
export function parseTransactionFilters(
  searchParams: Record<string, string | string[] | undefined>
): TransactionFilters {
  const type = firstValue(searchParams[TRANSACTION_PARAMS.type]);

  return {
    projectId: firstValue(searchParams[TRANSACTION_PARAMS.project]),
    type: type && isTransactionType(type) ? type : null,
  };
}
