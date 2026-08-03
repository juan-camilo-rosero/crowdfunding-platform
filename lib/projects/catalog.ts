import {
  CLOSED_PROJECT_STATUSES,
  PROJECT_CITIES,
  PROJECT_STATUSES,
  PROJECT_TYPES,
} from "@/lib/projects/enums";

/**
 * Catalogue filtering: which dimensions exist, how they are spelled in the URL,
 * and how the resulting list is ordered.
 *
 * The filter state lives entirely in the URL so a filtered catalogue can be
 * shared, bookmarked and reloaded. Query keys are Spanish because they are part
 * of a user-visible URL, like the routes themselves (see the language rule in
 * CLAUDE.md).
 */

export const CATALOG_PARAMS = {
  status: "estado",
  city: "ciudad",
  type: "tipo",
  progress: "avance",
} as const;

/**
 * Progress buckets, as ranges over projects.progress (an integer 0–100).
 *
 * The bounds do not overlap: the first bucket owns 25 and each later one starts
 * ABOVE its label's lower bound, so a project falls in exactly one bucket and
 * the counts always add up.
 */
export const PROGRESS_RANGES = [
  { id: "0-25", label: "0 – 25%", min: 0, max: 25 },
  { id: "25-50", label: "25 – 50%", min: 26, max: 50 },
  { id: "50-75", label: "50 – 75%", min: 51, max: 75 },
  { id: "75-100", label: "75 – 100%", min: 76, max: 100 },
] as const;

export type ProgressRangeId = (typeof PROGRESS_RANGES)[number]["id"];

export type CatalogFilters = {
  status: string | null;
  city: string | null;
  type: string | null;
  progress: ProgressRangeId | null;
};

export const EMPTY_CATALOG_FILTERS: CatalogFilters = {
  status: null,
  city: null,
  type: null,
  progress: null,
};

/** A single search param can arrive repeated; only the first value is used. */
function firstValue(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.trim() ? value.trim() : null;
}

/**
 * Reads the filters out of the URL, dropping anything that is not a real value.
 *
 * An unknown or hand-edited param is treated as absent rather than as a filter
 * that matches nothing: a mistyped URL shows the catalogue, never a blank page.
 */
export function parseCatalogFilters(
  searchParams: Record<string, string | string[] | undefined>
): CatalogFilters {
  const pick = (key: string, allowed: readonly string[]) => {
    const value = firstValue(searchParams[key]);
    return value && allowed.includes(value) ? value : null;
  };

  return {
    status: pick(CATALOG_PARAMS.status, PROJECT_STATUSES),
    city: pick(CATALOG_PARAMS.city, PROJECT_CITIES),
    type: pick(CATALOG_PARAMS.type, PROJECT_TYPES),
    progress: pick(
      CATALOG_PARAMS.progress,
      PROGRESS_RANGES.map((range) => range.id)
    ) as ProgressRangeId | null,
  };
}

export function hasActiveFilters(filters: CatalogFilters): boolean {
  return Object.values(filters).some((value) => value !== null);
}

export function findProgressRange(id: ProgressRangeId | null) {
  return PROGRESS_RANGES.find((range) => range.id === id) ?? null;
}

/**
 * Display order of the catalogue.
 *
 * The screen exists to raise capital, so what an investor can act on comes
 * first: projects currently raising, then the rest of the open ones, and closed
 * projects last — those are shown as track record, not as an opportunity.
 */
function catalogRank(project: {
  status: string | null;
  in_fundraising: boolean | null;
}): number {
  if (project.status && CLOSED_PROJECT_STATUSES.includes(project.status)) {
    return 2;
  }
  return project.in_fundraising ? 0 : 1;
}

export function sortCatalogProjects<
  T extends { status: string | null; in_fundraising: boolean | null; name: string },
>(projects: T[]): T[] {
  // Sorting a copy: the caller's array (a query result) is left untouched.
  return [...projects].sort(
    (a, b) => catalogRank(a) - catalogRank(b) || a.name.localeCompare(b.name, "es")
  );
}
