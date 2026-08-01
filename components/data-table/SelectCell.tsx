"use client";

import { ChevronDownIcon } from "lucide-react";
import { pillColorFor } from "@/lib/table/value-colors";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type SelectCellProps = {
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
};

/** The pill itself, reusable anywhere an enum value needs a colored chip. */
export function ValuePill({ value }: { value: string }) {
  const color = pillColorFor(value);

  return (
    <span
      className="inline-flex min-w-0 items-center gap-2 rounded-full px-2.5 py-1 text-sm font-normal"
      style={{ backgroundColor: color.bg, color: color.fg }}
    >
      <span
        aria-hidden="true"
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: color.fg }}
      />
      <span className="truncate">{value}</span>
    </span>
  );
}

/**
 * Cell for `type: "select"`.
 *
 * Always shows the value as a colored pill with a chevron — a single click on
 * the chevron opens the options, so these cells do not need the double-click
 * that the other types use. The menu is our own DropdownMenu rather than a
 * native <select>, because native <option> elements cannot inherit Poppins.
 */
export function SelectCell({ value, options, onChange }: SelectCellProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex h-full w-full cursor-pointer items-center justify-between gap-2 px-6.25 text-left outline-none"
          />
        }
      >
        {value ? (
          <ValuePill value={value} />
        ) : (
          <span className="text-base font-normal text-ink-400">—</span>
        )}
        <ChevronDownIcon className="size-4 shrink-0 text-ink-500" aria-hidden="true" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
        {options.map((option) => (
          <DropdownMenuItem key={option} onClick={() => onChange(option)}>
            <ValuePill value={option} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
