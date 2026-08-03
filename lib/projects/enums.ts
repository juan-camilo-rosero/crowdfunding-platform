/**
 * Stored values of the `projects` enum-like columns.
 *
 * Single source of truth: the admin panel's column definitions and the
 * catalogue filters both read from here, so a new city or status is added once.
 * These mirror the CHECK constraints in supabase/migrations — keep them in sync
 * with .claude/docs/database-schema.md.
 *
 * The values are Spanish because they are stored that way in the database (see
 * the language rule in CLAUDE.md); the identifiers around them stay English.
 */

export const PROJECT_COMPANIES = [
  "Investors 180 Group",
  "F1",
  "F3",
  "Otra LLC",
] as const;

export const PROJECT_CITIES = [
  "Punta Gorda",
  "Rotonda",
  "North Port",
  "Otra",
] as const;

export const PROJECT_TYPES = ["lote", "casa", "triplex", "multifamily"] as const;

export const PROJECT_STATUSES = [
  "en evaluación",
  "en reserva",
  "permisos",
  "construcción",
  "vendido",
  "rentado",
  "pausado",
] as const;

/**
 * Statuses that mean the project is over: no capital can go in anymore.
 * The catalogue hides them unless the visitor asks for them by filtering, and
 * sorts them last when they are shown.
 */
export const CLOSED_PROJECT_STATUSES: readonly string[] = ["vendido"];
