"use client";

import { usePathname, useRouter } from "next/navigation";
// Feather icons (lucide-react is the maintained fork): home, activity, x.
import { ActivityIcon, HomeIcon, XIcon } from "lucide-react";
import { es } from "@/i18n";
import { REQUEST_PARAMS } from "@/lib/requests/params";
import {
  REQUEST_STATUSES,
  type RequestFilters as Filters,
  type RequestProjectOption,
} from "@/lib/requests/types";
import { Button } from "@/components/ui/button";
import { FilterDropdown } from "@/components/filters/FilterDropdown";

export type RequestFiltersProps = {
  filters: Filters;
  /** Only destination projects present in this investor's own requests. */
  toProjectOptions: RequestProjectOption[];
  /** Results counter, already worded and formatted by the caller. */
  countLabel: string;
};

/**
 * The two filters of /solicitudes, on the same FilterDropdown the catalogue,
 * the sales funnel, transactions and documents use.
 *
 * Holds no state: the URL is the state. Narrowing the URL cannot widen the
 * data — the server scopes every query to the caller's own investor rows before
 * any of this applies (see lib/requests/query.ts).
 */
export function RequestFilters({
  filters,
  toProjectOptions,
  countLabel,
}: RequestFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();

  function apply(key: string, value: string | null) {
    const params = new URLSearchParams();
    const next: Record<string, string | null> = {
      [REQUEST_PARAMS.toProject]: filters.toProjectId,
      [REQUEST_PARAMS.status]: filters.status,
      [key]: value,
    };

    for (const [param, paramValue] of Object.entries(next)) {
      if (paramValue) params.set(param, paramValue);
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  const isFiltered = !!filters.toProjectId || !!filters.status;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <FilterDropdown
          icon={<HomeIcon />}
          ariaLabel={es.requests.filters.toProject}
          placeholder={es.requests.filters.toProject}
          clearLabel={es.requests.filters.allProjects}
          options={toProjectOptions.map((project) => ({
            value: project.id,
            label: project.name,
          }))}
          value={filters.toProjectId}
          onSelect={(value) => apply(REQUEST_PARAMS.toProject, value)}
        />

        <FilterDropdown
          icon={<ActivityIcon />}
          ariaLabel={es.requests.filters.status}
          placeholder={es.requests.filters.status}
          clearLabel={es.requests.filters.allStatuses}
          // The three values of the enum, always offered: unlike the project
          // list, a state the investor has none of is still a valid question.
          options={REQUEST_STATUSES.map((status) => ({
            value: status,
            label: es.requests.status[status] ?? status,
          }))}
          value={filters.status}
          onSelect={(value) => apply(REQUEST_PARAMS.status, value)}
        />

        {isFiltered ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-ink-700"
            onClick={() => router.push(pathname)}
          >
            <XIcon data-icon="inline-start" aria-hidden="true" />
            {es.requests.filters.clear}
          </Button>
        ) : null}
      </div>

      <p aria-live="polite" className="text-sm text-ink-500">
        {countLabel}
      </p>
    </div>
  );
}
