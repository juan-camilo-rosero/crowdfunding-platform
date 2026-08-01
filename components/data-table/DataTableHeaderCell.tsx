import { getColumnTypeMeta } from "@/lib/table/column-types";
import type { TableColumn } from "@/lib/table/types";

/**
 * Column header: the label plus an icon standing for the column's DATA TYPE
 * (not its value). Both share the same #1E1E1E ink.
 *
 * Design: 39px tall, #F2F2F2 fill, 1px #E2E2E2 rule, 25px inline padding,
 * label at 16px / weight 500.
 */
export function DataTableHeaderCell({ column }: { column: TableColumn }) {
  const { icon: Icon } = getColumnTypeMeta(column.type);

  return (
    <div className="flex h-9.75 items-center gap-2 px-6.25 text-ink-900">
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="truncate text-base font-medium">{column.label}</span>
    </div>
  );
}
