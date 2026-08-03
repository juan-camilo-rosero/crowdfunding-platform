"use client";

import { usePathname, useRouter } from "next/navigation";
// Feather icons (lucide-react is the maintained fork): activity, map-pin, home,
// percent, x all exist in the original set.
import {
  ActivityIcon,
  HomeIcon,
  MapPinIcon,
  PercentIcon,
  XIcon,
} from "lucide-react";
import { es } from "@/i18n";
import {
  CATALOG_PARAMS,
  PROGRESS_RANGES,
  hasActiveFilters,
  type CatalogFilters,
} from "@/lib/projects/catalog";
import {
  PROJECT_CITIES,
  PROJECT_STATUSES,
  PROJECT_TYPES,
} from "@/lib/projects/enums";
import { projectStatusLabel } from "@/lib/projects/labels";
import { Button } from "@/components/ui/button";
import { FilterDropdown } from "@/components/filters/FilterDropdown";

export type ProjectFilterBarProps = {
  filters: CatalogFilters;
  /**
   * Results counter, already worded and formatted by the caller — the catalogue
   * counts projects, "mis inversiones" counts positions.
   */
  countLabel: string;
};

/**
 * The four project filters plus the results counter.
 *
 * Shared by the catalogue (/portafolio) and "mis inversiones", which filter the
 * same dimensions over the same `projects` columns; only the set being filtered
 * differs. It reads its route from usePathname, so it rewrites whichever URL it
 * happens to be rendered on without being told.
 *
 * It holds no state of its own: the URL is the state. Every change rewrites the
 * search params and the server component re-queries, which keeps a filtered
 * screen shareable, bookmarkable and correct after a reload or a back button —
 * there is no second copy of the selection to fall out of sync.
 */
export function ProjectFilterBar({
  filters,
  countLabel,
}: ProjectFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();

  /** Rewrites one param and navigates; a null value drops it from the URL. */
  function apply(key: string, value: string | null) {
    const params = new URLSearchParams();

    const next: Record<string, string | null> = {
      [CATALOG_PARAMS.status]: filters.status,
      [CATALOG_PARAMS.city]: filters.city,
      [CATALOG_PARAMS.type]: filters.type,
      [CATALOG_PARAMS.progress]: filters.progress,
      [key]: value,
    };

    for (const [param, paramValue] of Object.entries(next)) {
      if (paramValue) params.set(param, paramValue);
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <FilterDropdown
          icon={<ActivityIcon />}
          ariaLabel={es.catalog.filters.status}
          placeholder={es.catalog.filters.status}
          clearLabel={es.catalog.filters.allStatuses}
          options={PROJECT_STATUSES.map((status) => ({
            value: status,
            label: projectStatusLabel(status),
          }))}
          value={filters.status}
          onSelect={(value) => apply(CATALOG_PARAMS.status, value)}
        />

        <FilterDropdown
          icon={<MapPinIcon />}
          ariaLabel={es.catalog.filters.city}
          placeholder={es.catalog.filters.city}
          clearLabel={es.catalog.filters.allCities}
          // Cities are stored already written the way they are displayed.
          options={PROJECT_CITIES.map((city) => ({ value: city, label: city }))}
          value={filters.city}
          onSelect={(value) => apply(CATALOG_PARAMS.city, value)}
        />

        <FilterDropdown
          icon={<HomeIcon />}
          ariaLabel={es.catalog.filters.type}
          placeholder={es.catalog.filters.type}
          clearLabel={es.catalog.filters.allTypes}
          options={PROJECT_TYPES.map((type) => ({
            value: type,
            label: es.projects.type[type] ?? type,
          }))}
          value={filters.type}
          onSelect={(value) => apply(CATALOG_PARAMS.type, value)}
        />

        <FilterDropdown
          icon={<PercentIcon />}
          ariaLabel={es.catalog.filters.progress}
          placeholder={es.catalog.filters.progress}
          clearLabel={es.catalog.filters.allProgress}
          options={PROGRESS_RANGES.map((range) => ({
            value: range.id,
            label: range.label,
          }))}
          value={filters.progress}
          onSelect={(value) => apply(CATALOG_PARAMS.progress, value)}
        />

        {/* Only offered once there is something to clear. */}
        {hasActiveFilters(filters) ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-zinc-600"
            onClick={() => router.push(pathname)}
          >
            <XIcon data-icon="inline-start" aria-hidden="true" />
            {es.catalog.filters.clear}
          </Button>
        ) : null}
      </div>

      <p aria-live="polite" className="text-sm text-zinc-500">
        {countLabel}
      </p>
    </div>
  );
}
