"use client";

import { usePathname, useRouter } from "next/navigation";
// Feather icons (lucide-react is the maintained fork): home, x.
import { HomeIcon, XIcon } from "lucide-react";
import { es } from "@/i18n";
import { DOCUMENT_PARAMS } from "@/lib/documents/params";
import {
  NO_PROJECT,
  type DocumentFilters as Filters,
  type DocumentProjectOption,
} from "@/lib/documents/types";
import { Button } from "@/components/ui/button";
import { FilterDropdown } from "@/components/filters/FilterDropdown";

export type DocumentFiltersProps = {
  filters: Filters;
  /** Only projects appearing in documents this caller can see. */
  projectOptions: DocumentProjectOption[];
  /** True when some document has no project, so "General" is worth offering. */
  hasUnassigned: boolean;
  /** Results counter, already worded and formatted by the caller. */
  countLabel: string;
};

/**
 * Project filter for /documentos, on the same FilterDropdown the catalogue, the
 * sales funnel and transactions use.
 *
 * Holds no state: the URL is the state. Narrowing the URL cannot widen the
 * data — RLS decides what exists for this caller before any of this applies.
 */
export function DocumentFilters({
  filters,
  projectOptions,
  hasUnassigned,
  countLabel,
}: DocumentFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();

  function apply(value: string | null) {
    const params = new URLSearchParams();
    if (value) params.set(DOCUMENT_PARAMS.project, value);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  const options = [
    ...projectOptions.map((project) => ({
      value: project.id,
      label: project.name,
    })),
    // Last in the list: it is a catch-all, not a project.
    ...(hasUnassigned
      ? [{ value: NO_PROJECT, label: es.documents.noProject }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <FilterDropdown
          icon={<HomeIcon />}
          ariaLabel={es.documents.filters.project}
          placeholder={es.documents.filters.project}
          clearLabel={es.documents.filters.allProjects}
          options={options}
          value={filters.projectId}
          onSelect={apply}
        />

        {filters.projectId ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-ink-700"
            onClick={() => router.push(pathname)}
          >
            <XIcon data-icon="inline-start" aria-hidden="true" />
            {es.documents.filters.clear}
          </Button>
        ) : null}
      </div>

      <p aria-live="polite" className="text-sm text-ink-500">
        {countLabel}
      </p>
    </div>
  );
}
