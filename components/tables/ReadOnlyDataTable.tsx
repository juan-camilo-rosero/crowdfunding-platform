import type { ReactNode } from "react";
import { getColumnTypeMeta } from "@/lib/table/column-types";
import { formatCellValue, resolveColumnWidth } from "@/lib/table/format-cell";
import type { TableColumn, TableRow } from "@/lib/table/types";
import { cn } from "@/lib/utils";
import { DataTableHeaderCell } from "@/components/data-table/DataTableHeaderCell";

/** Stands in for a value that is not there, so no cell reads as broken. */
const EMPTY_VALUE = "—";

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
  /**
   * Column that IDENTIFIES the record — the project, the person, the document.
   * Its cells are set in the darker ink, so the eye lands on the name first and
   * reads the rest of the row around it. Purely presentational: it changes no
   * value and no order.
   */
  emphasizeColumn?: string;
  /** Accessible name for the table. */
  caption: string;
  className?: string;
};

/**
 * Read-only table for the investor screens (transactions, documents, requests)
 * and the admin directories.
 *
 * NOT EditableDataTable with editing switched off. That component owns draft
 * state, dirty tracking and a save pipeline; carrying all of it just to disable
 * it would mean every future change to editing had to be re-checked against a
 * screen that must never write. This one has no state at all — it takes rows
 * and renders them.
 *
 * What the two DO share is the visual vocabulary, imported rather than copied:
 * DataTableHeaderCell for the headers, formatCellValue for the cell text and
 * resolveColumnWidth for the widths. A column definition written for one works
 * unchanged in the other.
 *
 * THE LOOK is a list, not a spreadsheet. The grid keeps its cell boundaries
 * because you edit inside them; here every vertical rule was a line the eye had
 * to cross to finish reading one record, so rows are separated only by a
 * hairline and held together by a card. Numbers align right under a header that
 * aligns with them, empty values say so with a dash instead of a gap, and the
 * row under the pointer lifts a shade.
 *
 * A real <table>, unlike the editable grid's div layout: this content is
 * tabular data being read, so screen readers should get rows and headers.
 */
export function ReadOnlyDataTable({
  columns,
  rows,
  emptyState,
  renderCell,
  emphasizeColumn,
  caption,
  className,
}: ReadOnlyDataTableProps) {
  if (rows.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div
      className={cn(
        // The card: rounded like the rest of the app's panels, lifted off the
        // canvas by a hairline and the faintest shadow rather than by a fill.
        "w-full overflow-x-auto rounded-[10px] border border-line bg-elevated",
        "shadow-[0_1px_2px_rgba(30,30,30,0.04)] scrollbar-thin",
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
                className="p-0 font-normal"
              >
                <DataTableHeaderCell column={column} variant="list" />
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr
              key={String(row.id ?? index)}
              className="border-b border-line transition-colors last:border-b-0 hover:bg-surface/60"
            >
              {columns.map((column) => {
                const custom = renderCell?.(row, column);
                const content =
                  custom !== undefined
                    ? custom
                    : formatCellValue(row[column.key], column.type);
                // Covers both sources of "nothing here": a null value and a
                // renderCell that returned an empty string for one.
                const isEmpty =
                  content === "" || content === null || content === undefined;

                return (
                  <td
                    key={column.key}
                    className={cn(
                      "px-6.25 py-4 align-middle text-base text-ink-700",
                      getColumnTypeMeta(column.type).align === "right" &&
                        "text-right",
                      column.key === emphasizeColumn &&
                        "font-medium text-ink-900"
                    )}
                  >
                    {isEmpty ? (
                      <span className="text-ink-400">{EMPTY_VALUE}</span>
                    ) : (
                      content
                    )}
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
