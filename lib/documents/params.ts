import type { DocumentFilters } from "./types";

/**
 * URL spelling of the /documentos filter. Spanish key, like the routes
 * themselves, because it is part of a user-visible URL (CLAUDE.md).
 */
export const DOCUMENT_PARAMS = { project: "proyecto" } as const;

/**
 * Reads the filter out of the URL.
 *
 * The value is not validated against a list of allowed ids, and does not need
 * to be: RLS decides which documents exist for this caller, so an id belonging
 * to someone else's project simply matches nothing.
 */
export function parseDocumentFilters(
  searchParams: Record<string, string | string[] | undefined>
): DocumentFilters {
  const raw = searchParams[DOCUMENT_PARAMS.project];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return { projectId: value?.trim() ? value.trim() : null };
}
