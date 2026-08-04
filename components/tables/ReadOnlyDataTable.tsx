import type { ReactNode } from "react";
import { formatCellValue, resolveColumnWidth } from "@/lib/table/format-cell";
import type { TableColumn, TableRow } from "@/lib/table/types";
import { cn } from "@/lib/utils";
import { DataTableHeaderCell } from "@/components/data-table/DataTableHeaderCell";

export type ReadOnlyDataTableProps = {
  columns: TableColumn[];
  rows: TableRow[];
  /** Rendered instead of the table body when there are no rows. */
  emptyState?: ReactNode;
  /**
   * Overrides the text for one cell. Use it for values the column type cannot
   * format on its own — a joined project name, a translated enum label.
   * Returning undefined falls back to formatCellValue.
   */
  renderCell?: (row: TableRow, column: TableColumn) => ReactNode | undefined;
  /** Accessible name for the table. */
  caption: string;
  className?: string;
};

/**
 * Read-only table for the investor screens (transactions, documents, requests).
 *
 * NOT EditableDataTable with editing switched off. That component owns draft
 * state, dirty tracking, an insert row and a save pipeline; carrying all of it
 * just to disable it would mean every future change to editing had to be
 * re-checked against a screen that must never write. This one has no state at
 * all — it takes rows and renders them.
 *
 * What the two DO share is the visual vocabulary, imported rather than copied:
 * DataTableHeaderCell for the headers, formatCellValue for the cell text and
 * resolveColumnWidth for the widths. A column definition written for one works
 * unchanged in the other.
 *
 * A real <table> here, unlike the editable grid's div layout: this content is
 * tabular data being read, so screen readers should get rows and headers.
 */
export function ReadOnlyDataTable({
  columns,
  rows,
  emptyState,
  renderCell,
  caption,
  className,
}: ReadOnlyDataTableProps) {
  if (rows.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div
      className={cn(
        "w-full overflow-x-auto rounded-[5px] border border-line",
        className
      )}
    >
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">{caption}</caption>

        <thead>
          <tr className="border-b border-line bg-surface">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={{ minWidth: resolveColumnWidth(column) }}
                className="border-r border-line p-0 font-normal last:border-r-0"
              >
                <DataTableHeaderCell column={column} />
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr
              key={String(row.id ?? index)}
              className="border-b border-line last:border-b-0"
            >
              {columns.map((column) => {
                const custom = renderCell?.(row, column);
                return (
                  <td
                    key={column.key}
                    className="border-r border-line bg-elevated px-6.25 py-3 text-base text-ink-700 last:border-r-0"
                  >
                    {custom !== undefined
                      ? custom
                      : formatCellValue(row[column.key], column.type)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
