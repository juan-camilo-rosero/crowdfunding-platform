"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  ActivityIcon,
  BuildingIcon,
  FilterIcon,
  HomeIcon,
  ListIcon,
  MapPinIcon,
  UserIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import { es } from "@/i18n";
import {
  filterParamName,
  filterableColumns,
  hasActiveTableFilters,
  type TableFilters,
} from "@/lib/table/filters";
import { optionLabel, optionValue, type TableColumn } from "@/lib/table/types";
import { Button } from "@/components/ui/button";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { ValuePill } from "./SelectCell";

/** Icon per column, so the bar reads like the catalogue's rather than a row of
 *  identical funnels. Anything unmapped falls back to the generic filter. */
const COLUMN_ICONS: Record<string, LucideIcon> = {
  status: ActivityIcon,
  paid_status: ActivityIcon,
  city: MapPinIcon,
  type: HomeIcon,
  company: BuildingIcon,
  project_id: HomeIcon,
  investor_id: UserIcon,
  category: ListIcon,
  stage: ActivityIcon,
  pipeline_stage: ActivityIcon,
};

export type TableFilterBarProps = {
  /** Same definitions the grid uses; the filterable ones are derived from them. */
  columns: TableColumn[];
  /** Active selection, already validated by parseTableFilters on the server. */
  filters: TableFilters;
  /** Params that must survive a filter change — `?tabla=` above all. */
  preservedParams?: Record<string, string>;
  /** Results counter, worded and formatted by the caller. */
  countLabel: string;
  /**
   * Run before navigating away. The panel uses it to flush edits still waiting
   * in the autosave buffer, so a filter change can never drop them.
   */
  beforeNavigate?: () => void | Promise<void>;
  /** Trailing controls on the same row — the "new record" button. */
  actions?: React.ReactNode;
};

/**
 * Filter bar for the editable tables, built from the same FilterDropdown the
 * catalogue and the sales funnel use.
 *
 * Deliberately NOT a second filtering mechanism: the URL is the state, exactly
 * as in ProjectFilterBar, so the server narrows the query and the grid only
 * ever receives rows it should show. Filtering on the client would have lied as
 * soon as the table passed its row limit — the admin would be filtering the
 * first hundred records rather than the table.
 */
export function TableFilterBar({
  columns,
  filters,
  preservedParams,
  countLabel,
  beforeNavigate,
  actions,
}: TableFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const available = filterableColumns(columns);

  /** Rewrites one filter and navigates; a null value drops it from the URL. */
  async function apply(columnKey: string, value: string | null) {
    await beforeNavigate?.();

    const params = new URLSearchParams();

    for (const [key, paramValue] of Object.entries(preservedParams ?? {})) {
      if (paramValue) params.set(key, paramValue);
    }

    const next: TableFilters = { ...filters };
    if (value === null) delete next[columnKey];
    else next[columnKey] = value;

    for (const [key, paramValue] of Object.entries(next)) {
      params.set(filterParamName(key), paramValue);
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  async function clearAll() {
    await beforeNavigate?.();

    const params = new URLSearchParams();
    for (const [key, paramValue] of Object.entries(preservedParams ?? {})) {
      if (paramValue) params.set(key, paramValue);
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  const isFiltered = hasActiveTableFilters(filters);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {available.map((column) => {
          const Icon = COLUMN_ICONS[column.key] ?? FilterIcon;
          const options = (column.options ?? []).map((option) => ({
            value: optionValue(option),
            label: optionLabel(option),
          }));
          // References (a project, an investor) read as names, not as states:
          // a pill on them would invent a status that does not exist.
          const isReference = column.key.endsWith("_id");

          return (
            <FilterDropdown
              key={column.key}
              icon={<Icon />}
              ariaLabel={es.admin.filters.by.replace("{campo}", column.label)}
              placeholder={column.label}
              clearLabel={es.admin.filters.all.replace("{campo}", column.label)}
              options={options}
              value={filters[column.key] ?? null}
              renderOption={
                isReference
                  ? undefined
                  : (option) => <ValuePill value={option.label} />
              }
              onSelect={(value) => void apply(column.key, value)}
            />
          );
        })}

        {/* Only offered once there is something to clear. */}
        {isFiltered ? (
          <Button variant="ghost" size="sm" onClick={() => void clearAll()}>
            <XIcon data-icon="inline-start" aria-hidden="true" />
            {es.admin.filters.clear}
          </Button>
        ) : null}

        {/* The count closes the row of filters it describes; the creation
            button stays at the far end, where an action belongs. */}
        <p aria-live="polite" className="ml-auto text-sm text-ink-500">
          {countLabel}
        </p>

        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
