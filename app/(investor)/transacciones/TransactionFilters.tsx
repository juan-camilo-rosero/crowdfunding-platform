"use client";

import { usePathname, useRouter } from "next/navigation";
// Feather icons (lucide-react is the maintained fork): home, repeat, x.
import { HomeIcon, RepeatIcon, XIcon } from "lucide-react";
import { es } from "@/i18n";
import { TRANSACTION_PARAMS } from "@/lib/transactions/params";
import type {
  TransactionFilters as Filters,
  TransactionProjectOption,
} from "@/lib/transactions/types";
import { Button } from "@/components/ui/button";
import { FilterDropdown } from "@/components/filters/FilterDropdown";

export type TransactionFiltersProps = {
  filters: Filters;
  /** Only projects this investor has movements in. Built on the server. */
  projectOptions: TransactionProjectOption[];
  /** Only movement types present in this investor's history. */
  typeOptions: string[];
  /** Results counter, already worded and formatted by the caller. */
  countLabel: string;
};

/**
 * The two filters of /transacciones, on the same FilterDropdown the catalogue
 * and the sales funnel use.
 *
 * Holds no state: the URL is the state, so a filtered view survives a reload
 * and can be shared. Narrowing the URL cannot widen the data — the server
 * scopes every query to the caller's own investor rows before applying any of
 * this (see lib/transactions/query.ts).
 */
export function TransactionFilters({
  filters,
  projectOptions,
  typeOptions,
  countLabel,
}: TransactionFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();

  function apply(key: string, value: string | null) {
    const params = new URLSearchParams();
    const next: Record<string, string | null> = {
      [TRANSACTION_PARAMS.project]: filters.projectId,
      [TRANSACTION_PARAMS.type]: filters.type,
      [key]: value,
    };

    for (const [param, paramValue] of Object.entries(next)) {
      if (paramValue) params.set(param, paramValue);
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  const isFiltered = !!filters.projectId || !!filters.type;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <FilterDropdown
          icon={<HomeIcon />}
          ariaLabel={es.transactions.filters.project}
          placeholder={es.transactions.filters.project}
          clearLabel={es.transactions.filters.allProjects}
          options={projectOptions.map((project) => ({
            value: project.id,
            label: project.name,
          }))}
          value={filters.projectId}
          onSelect={(value) => apply(TRANSACTION_PARAMS.project, value)}
        />

        <FilterDropdown
          icon={<RepeatIcon />}
          ariaLabel={es.transactions.filters.type}
          placeholder={es.transactions.filters.type}
          clearLabel={es.transactions.filters.allTypes}
          options={typeOptions.map((type) => ({
            value: type,
            label: es.transactions.type[type] ?? type,
          }))}
          value={filters.type}
          onSelect={(value) => apply(TRANSACTION_PARAMS.type, value)}
        />

        {isFiltered ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-zinc-600"
            onClick={() => router.push(pathname)}
          >
            <XIcon data-icon="inline-start" aria-hidden="true" />
            {es.transactions.filters.clear}
          </Button>
        ) : null}
      </div>

      <p aria-live="polite" className="text-sm text-zinc-500">
        {countLabel}
      </p>
    </div>
  );
}
