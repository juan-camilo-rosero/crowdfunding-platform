import { isRequestStatus, type RequestFilters } from "./types";

/**
 * URL spelling of the /solicitudes filters. Spanish keys, like the routes
 * themselves, because they are part of a user-visible URL (CLAUDE.md).
 */
export const REQUEST_PARAMS = {
  toProject: "destino",
  status: "estado",
} as const;

function firstValue(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.trim() ? value.trim() : null;
}

/**
 * Reads the filters out of the URL.
 *
 * An unknown status is dropped rather than kept: a hand-edited URL shows the
 * whole list instead of an empty table that looks like a bug. The project id is
 * NOT validated here and does not need to be — the query scopes to the caller's
 * own requests first, so a foreign id simply matches nothing.
 */
export function parseRequestFilters(
  searchParams: Record<string, string | string[] | undefined>
): RequestFilters {
  const status = firstValue(searchParams[REQUEST_PARAMS.status]);

  return {
    toProjectId: firstValue(searchParams[REQUEST_PARAMS.toProject]),
    status: status && isRequestStatus(status) ? status : null,
  };
}
