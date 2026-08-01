"use client";

import { useMemo, useState } from "react";
import { PlusIcon } from "lucide-react";
import { resolveColumnWidth } from "@/lib/table/format-cell";
import type { TableColumn, TableRow } from "@/lib/table/types";
import { cn } from "@/lib/utils";
import { EditableCell } from "./EditableCell";
import { DataTableHeaderCell } from "./DataTableHeaderCell";

const HEADER_HEIGHT = "h-9.75";
const ROW_HEIGHT = "h-10.25";
/** Width of the leading row-number column, in px. */
const INDEX_COLUMN_WIDTH = 52;

export type EditableDataTableProps = {
  /** Serializable column definitions; see lib/table/types.ts. */
  columns: TableColumn[];
  /** Records to display. Keys must match `TableColumn.key`. */
  rows: TableRow[];
  /** Field used as the stable row key. Defaults to "id", falls back to index. */
  rowIdKey?: string;
  /**
   * Notified on every committed cell edit of an EXISTING row. The table already
   * keeps the value locally; this is for callers tracking pending changes.
   */
  onCellChange?: (rowId: string, columnKey: string, value: string) => void;
  /** Notified when a draft row becomes a new record. */
  onRowCreate?: (row: TableRow) => void;
  /** Renders the trailing draft row that creates records. */
  showNewRecordRow?: boolean;
  emptyMessage?: string;
};

/**
 * Airtable-style editable grid, reusable for any table in the app.
 *
 * One single grid: the row-number column is the first column, not a separate
 * block. Only the whole grid scrolls horizontally, and it is the one section
 * allowed to exceed the protected content width.
 *
 * Editing is per cell (double click; single click on `select` columns) and
 * lives in LOCAL STATE only — nothing is persisted yet.
 *
 * IMPORTANT — pass a `key` tied to the dataset:
 *
 *     <EditableDataTable key={tableId} columns={...} rows={...} />
 *
 * Swapping `columns`/`rows` for a different table does NOT reset this
 * component: React keeps it mounted at the same tree position, so drafts,
 * created rows and cell edits would carry over into the new table. The `key` is
 * what forces a remount and clears them.
 */
export function EditableDataTable({
  columns,
  rows,
  rowIdKey = "id",
  onCellChange,
  onRowCreate,
  showNewRecordRow = true,
  emptyMessage = "No hay registros todavía.",
}: EditableDataTableProps) {
  // Overrides for existing rows, keyed by `${rowId}:${columnKey}`.
  const [edits, setEdits] = useState<Record<string, string>>({});
  // Records created locally from the draft row (not persisted).
  const [createdRows, setCreatedRows] = useState<TableRow[]>([]);
  // Values typed into the draft row before it becomes a record.
  const [draft, setDraft] = useState<TableRow>({});

  const widths = useMemo(
    () => columns.map((column) => resolveColumnWidth(column)),
    [columns]
  );
  const totalWidth = useMemo(
    () => widths.reduce((sum, width) => sum + width, INDEX_COLUMN_WIDTH),
    [widths]
  );

  const allRows = useMemo(() => [...rows, ...createdRows], [rows, createdRows]);

  const rowIds = useMemo(
    () =>
      allRows.map((row, index) => String(row[rowIdKey] ?? `row-${index}`)),
    [allRows, rowIdKey]
  );

  function valueFor(rowIndex: number, column: TableColumn) {
    const key = `${rowIds[rowIndex]}:${column.key}`;
    return key in edits ? edits[key] : allRows[rowIndex][column.key];
  }

  function handleCommit(rowIndex: number, column: TableColumn, value: string) {
    const rowId = rowIds[rowIndex];
    setEdits((current) => ({ ...current, [`${rowId}:${column.key}`]: value }));
    onCellChange?.(rowId, column.key, value);
  }

  /**
   * Filling ANY cell of the draft row turns it into a record: it gets a number,
   * and a fresh empty draft row appears underneath.
   */
  function handleDraftCommit(column: TableColumn, value: string) {
    if (value === "") return;

    // Id derived from the current count: unique (rows are never removed here)
    // and pure, unlike Date.now().
    const created: TableRow = {
      ...draft,
      [column.key]: value,
      [rowIdKey]: `local-${createdRows.length}`,
    };
    setCreatedRows((current) => [...current, created]);
    setDraft({});
    onRowCreate?.(created);
  }

  if (allRows.length === 0 && !showNewRecordRow) {
    return (
      <p className="rounded-[5px] border border-line bg-elevated px-6.25 py-6 text-base text-ink-700">
        {emptyMessage}
      </p>
    );
  }

  return (
    // Scrollbar hidden: it used to overlay the last row. Scroll with a trackpad,
    // shift+wheel, or by focusing a cell and using the arrow keys.
    <div className="w-full overflow-x-auto rounded-[5px] border border-line scrollbar-none selection:bg-brand selection:text-elevated">
      <div style={{ minWidth: totalWidth }}>
        {/* Header */}
        <div className={cn(HEADER_HEIGHT, "flex border-b border-line bg-surface")}>
          <div
            style={{ width: INDEX_COLUMN_WIDTH }}
            className="shrink-0 border-r border-line"
          />
          {columns.map((column, columnIndex) => (
            <div
              key={column.key}
              style={{ width: widths[columnIndex] }}
              className="shrink-0 border-r border-line last:border-r-0"
            >
              <DataTableHeaderCell column={column} />
            </div>
          ))}
        </div>

        {/* Records */}
        {allRows.map((_, rowIndex) => (
          <div
            key={rowIds[rowIndex]}
            className={cn(ROW_HEIGHT, "flex border-b border-line")}
          >
            <div
              style={{ width: INDEX_COLUMN_WIDTH }}
              className="flex shrink-0 items-center justify-center border-r border-line bg-elevated text-base font-normal text-ink-700"
            >
              {rowIndex + 1}
            </div>
            {columns.map((column, columnIndex) => (
              <div
                key={column.key}
                style={{ width: widths[columnIndex] }}
                className="shrink-0 border-r border-line bg-elevated last:border-r-0"
              >
                <EditableCell
                  column={column}
                  value={valueFor(rowIndex, column)}
                  onCommit={(value) => handleCommit(rowIndex, column, value)}
                />
              </div>
            ))}
          </div>
        ))}

        {/* Draft row — fill any cell to create a record. */}
        {showNewRecordRow ? (
          <div
            // Remounting on every creation clears the inputs.
            key={`draft-${createdRows.length}`}
            className={cn(ROW_HEIGHT, "flex")}
          >
            <div
              style={{ width: INDEX_COLUMN_WIDTH }}
              className="flex shrink-0 items-center justify-center border-r border-line bg-elevated text-ink-700"
            >
              <PlusIcon className="size-4" aria-hidden="true" />
            </div>
            {columns.map((column, columnIndex) => (
              <div
                key={column.key}
                style={{ width: widths[columnIndex] }}
                className="shrink-0 border-r border-line bg-elevated last:border-r-0"
              >
                <EditableCell
                  column={column}
                  value={draft[column.key] ?? ""}
                  onCommit={(value) => handleDraftCommit(column, value)}
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
