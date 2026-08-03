"use client";

import type { ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type FilterOption = {
  /** Stored value; goes to the URL and to the query. */
  value: string;
  /** Text shown to the user. */
  label: string;
};

export type FilterDropdownProps = {
  /** Icon for this dimension (status, city, type…). Sized by the component. */
  icon: ReactNode;
  /** Shown on the trigger while nothing is selected. Names the dimension. */
  placeholder: string;
  options: readonly FilterOption[];
  /** Selected value, or null when the filter is off. */
  value: string | null;
  /** Called with the new value, or null when the clear entry is picked. */
  onSelect: (value: string | null) => void;
  /** Label of the leading entry that turns the filter off. */
  clearLabel: string;
  /**
   * Renders an option as something richer than plain text — the sales funnel
   * passes the same coloured chip its table uses, so a stage looks identical
   * wherever it appears. Applies to the menu entries AND to the selected value
   * on the trigger; the clear entry always stays plain text, since it names no
   * value.
   */
  renderOption?: (option: FilterOption) => ReactNode;
  /** Accessible name for the trigger. */
  ariaLabel: string;
  className?: string;
};

/**
 * One dropdown filter. Shared by the catalogue (/portafolio) and the sales
 * funnel (/admin/pipeline) so both look and behave the same.
 *
 * It owns no state: the selected value comes in as a prop and every change goes
 * out through `onSelect`. That is what lets each screen decide what a selection
 * means — the funnel guards unsaved edits before navigating, the catalogue
 * rewrites its search params — without this component knowing about either.
 */
export function FilterDropdown({
  icon,
  placeholder,
  options,
  value,
  onSelect,
  clearLabel,
  renderOption,
  ariaLabel,
  className,
}: FilterDropdownProps) {
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={ariaLabel}
        className={cn(
          // w-max keeps the trigger as wide as its own label: without it a flex
          // parent stretches it across the row.
          "inline-flex w-max cursor-pointer items-center gap-2 rounded-[5px] bg-stone-50 pt-2.5 pr-1.5 pb-2 pl-2.5 text-sm font-medium text-stone-900 outline outline-1 -outline-offset-1 outline-neutral-200 hover:bg-stone-100",
          // Marks the dimension as active without adding a second control.
          value !== null && "outline-stone-900",
          className
        )}
      >
        {/* Both icons inherit the label's colour rather than carrying one. */}
        <span
          aria-hidden="true"
          className="flex size-4 shrink-0 items-center justify-center [&>svg]:size-4"
        >
          {icon}
        </span>

        <span className="truncate">
          {selected
            ? (renderOption?.(selected) ?? selected.label)
            : placeholder}
        </span>

        <ChevronDownIcon className="size-4 shrink-0" aria-hidden="true" />
      </DropdownMenuTrigger>

      {/* Roomier on desktop: larger text and more padding per option. */}
      <DropdownMenuContent
        align="start"
        className="bg-stone-50 md:min-w-56 md:p-1.5"
      >
        <DropdownMenuItem
          className="md:px-3 md:py-2 md:text-base"
          onClick={() => onSelect(null)}
        >
          {clearLabel}
        </DropdownMenuItem>

        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            className="md:px-3 md:py-2 md:text-base"
            onClick={() => onSelect(option.value)}
          >
            {renderOption?.(option) ?? option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
