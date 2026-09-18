/**
 * Reads a boolean cell value, whatever shape it arrived in.
 *
 * Two shapes are real: a boolean from the database, and the STRING
 * "true"/"false" the grid keeps for a local edit — every committed cell value
 * is a string, because that is what the batch save carries. Reading the string
 * with plain truthiness made "false" count as true, which is why switching
 * "En captación" off appeared to do nothing.
 *
 * Anything else is `null`: unknown is not the same as no, and a caller that
 * needs a definite answer decides what unknown means for it.
 */
export function parseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}
