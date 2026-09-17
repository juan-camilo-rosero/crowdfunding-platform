import { getColumnTypeMeta } from "@/lib/table/column-types";
import type { TableColumn } from "@/lib/table/types";
import { cn } from "@/lib/utils";

/**
 * How a header presents itself, per table.
 *
 *   grid  the editable panel: the label plus an icon standing for the column's
 *         DATA TYPE. The icon earns its place there because the type is what
 *         decides which editor a cell opens.
 *   list  the read-only tables: a quiet uppercase label, no icon. Nothing is
 *         edited on those screens, so the type icon was decoration repeating
 *         what the values already say — and it competed with the data for
 *         attention. The label steps back and the rows read first.
 */
export type HeaderCellVariant = "grid" | "list";

export type DataTableHeaderCellProps = {
  column: TableColumn;
  variant?: HeaderCellVariant;
};

/**
 * Column header.
 *
 * Both variants take their ALIGNMENT from the column type, so a header sits
 * over its own values instead of drifting to the left of a right-aligned money
 * column — which is what made the numeric columns look unfinished.
 *
 * Design: grid 39px tall, #F2F2F2 fill, 1px #E2E2E2 rule, 25px inline padding,
 * label at 16px / weight 500; list 44px tall, label at 12px / weight 500 /
 * uppercase / #848484.
 */
export function DataTableHeaderCell({
  column,
  variant = "grid",
}: DataTableHeaderCellProps) {
  const { icon: Icon, align } = getColumnTypeMeta(column.type);

  if (variant === "list") {
    return (
      <div
        className={cn(
          "flex h-11 items-center px-6.25 text-xs font-medium tracking-[0.06em] text-ink-500 uppercase",
          align === "right" && "justify-end"
        )}
      >
        <span className="truncate">{column.label}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-9.75 items-center gap-2 px-6.25 text-ink-900",
        align === "right" && "justify-end"
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="truncate text-base font-medium">{column.label}</span>
    </div>
  );
}
