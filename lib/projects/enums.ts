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

/**
 * Statuses that mean the project no longer takes capital.
 *
 * `vendido` is finished; `rentado` is already producing income and closed to
 * new money. Both are worth SHOWING — they are the group's track record — but
 * neither is an opportunity.
 */
export const NOT_INVESTABLE_STATUSES: readonly string[] = ["vendido", "rentado"];

/**
 * Whether a project is closed to new investment.
 *
 * Two ways to get there: a status that means it is done, or work finished
 * (progress at 100%). The screens use this to stop inviting an investment that
 * cannot happen — without hiding the project, which would leave an investor who
 * holds capital in it unable to find it.
 */
export function isClosedToInvestment(project: {
  status?: string | null;
  progress?: number | null;
}): boolean {
  if (project.status && NOT_INVESTABLE_STATUSES.includes(project.status)) {
    return true;
  }
  return typeof project.progress === "number" && project.progress >= 100;
}
