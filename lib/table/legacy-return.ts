/**
 * Retires a project's legacy free-text return when its structured offer is
 * written.
 *
 * `offered_return` is only a FALLBACK the catalogue shows while `return_offer`
 * is unset. The moment an admin writes the offer — or clears it — the old text
 * would either be hidden behind it or, worse, reappear after a clear. Blanking
 * it in the same write keeps a single source of truth.
 *
 * Applied after validation, server side: `offered_return` is not an editable
 * column, so it could never come from the client.
 */
export function withRetiredLegacyReturn(
  table: string,
  values: Record<string, string | null>
): Record<string, string | null> {
  if (table !== "projects" || !("return_offer" in values)) return values;
  return { ...values, offered_return: null };
}
