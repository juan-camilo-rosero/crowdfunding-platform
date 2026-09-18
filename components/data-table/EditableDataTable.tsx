"use client";

import { useMemo, useState, type ReactNode } from "react";
import { resolveColumnWidth } from "@/lib/table/format-cell";
import { buildSubtitle } from "@/lib/table/subtitle";
import type { TableColumn, TableRow } from "@/lib/table/types";
import { cn } from "@/lib/utils";
import { EditableCell } from "./EditableCell";
import { DataTableHeaderCell } from "./DataTableHeaderCell";

const HEADER_HEIGHT = "h-9.75";
const ROW_HEIGHT = "h-10.25";
/**
 * Row height when a column carries a second line. EVERY row takes it, not only
 * the ones whose detail happens to be filled in: rows of two heights in one
 * grid read as a rendering fault, and the sticky columns would stop lining up.
 */
const STACKED_ROW_HEIGHT = "h-14";
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
   * Reports ONE committed cell, as soon as it is committed. The caller decides
   * when it reaches the server; this component does not wait for an answer.
   */
  onCellCommit?: (rowId: string, columnKey: string, value: string) => void;
  /** Rows with an edit not yet confirmed by the server. Marked, not blocked. */
  pendingRowIds?: readonly string[];
  /** Rows whose last save failed. Marked so the admin can find them again. */
  errorRowIds?: readonly string[];
  /**
   * Optional trailing column holding a control per record — the projects tab
   * uses it to open the photo manager.
   *
   * Deliberately a render prop rather than a new column type: what goes in it
   * is a client component with its own state, which a serializable
   * TableColumn cannot describe.
   */
  rowAction?: { label: string; width?: number; render: (row: TableRow) => ReactNode };
  emptyMessage?: string;
};

/**
 * Airtable-style editable grid, reusable for any table in the app.
 *
 * One single grid: the row-number column is the first column, not a separate
 * block. Only the whole grid scrolls, and it is the one section allowed to
 * exceed the protected content width.
 *
 * Editing is per cell (double click, or Enter/F2 on the focused cell; single
 * click on `select` columns). Every commit is reported through `onCellCommit`
 * the moment it happens — records are NOT created here: that is a form, not a
 * grid row, and it lives in RecordFormDialog.
 *
 * IMPORTANT — pass a `key` tied to the dataset:
 *
 *     <EditableDataTable key={tableId} columns={...} rows={...} />
 *
 * Swapping `columns`/`rows` for a different table does NOT reset this
 * component: React keeps it mounted at the same tree position, so cell edits
 * would carry over into the new table. The `key` is what forces a remount.
 */
export function EditableDataTable({
  columns,
  rows,
  rowIdKey = "id",
  onCellCommit,
  pendingRowIds,
  errorRowIds,
  rowAction,
  emptyMessage = "No hay registros todavía.",
}: EditableDataTableProps) {
  /** Locally committed values, kept on screen until the server confirms them. */
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});

  const widths = useMemo(
    () => columns.map((column) => resolveColumnWidth(column)),
    [columns]
  );
  /** Width of the optional trailing action column. */
  const actionWidth = rowAction ? (rowAction.width ?? 140) : 0;
  const totalWidth = useMemo(
    () =>
      widths.reduce((sum, width) => sum + width, INDEX_COLUMN_WIDTH) +
      actionWidth,
    [widths, actionWidth]
  );

  const rowIds = useMemo(
    () => rows.map((row, index) => String(row[rowIdKey] ?? "row-" + index)),
    [rows, rowIdKey]
  );

  /**
   * Ids the server would recognise. A row without one can still be READ — a
   * view or an aggregate may legitimately have no id — but an edit to it has
   * nowhere to go: the batch save addresses records by id, so sending the
   * positional fallback would either fail the whole batch or, worse, name a
   * record that is not the one on screen.
   */
  const persistedIds = useMemo(
    () =>
      new Set(
        rows
          .map((row) => row[rowIdKey])
          .filter((id) => id !== null && id !== undefined && id !== "")
          .map(String)
      ),
    [rows, rowIdKey]
  );

  const pending = useMemo(() => new Set(pendingRowIds ?? []), [pendingRowIds]);

  const isStacked = useMemo(
    () => columns.some((column) => (column.subtitle?.length ?? 0) > 0),
    [columns]
  );
  const rowHeight = isStacked ? STACKED_ROW_HEIGHT : ROW_HEIGHT;
  const failed = useMemo(() => new Set(errorRowIds ?? []), [errorRowIds]);

  /**
   * The value ON SCREEN for a field: the local edit when there is one, the
   * server's otherwise. By key rather than by column, because a subtitle can
   * name a field the table does not show — which simply never has an edit.
   */
  function valueForKey(rowIndex: number, key: string) {
    const rowId = rowIds[rowIndex];
    const edited = edits[rowId]?.[key];
    return edited !== undefined ? edited : rows[rowIndex][key];
  }

  function valueFor(rowIndex: number, column: TableColumn) {
    return valueForKey(rowIndex, column.key);
  }

  function handleCommit(rowIndex: number, column: TableColumn, value: string) {
    const rowId = rowIds[rowIndex];
    if (!persistedIds.has(rowId)) return;

    setEdits((current) => ({
      ...current,
      [rowId]: { ...(current[rowId] ?? {}), [column.key]: value },
    }));

    onCellCommit?.(rowId, column.key, value);
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-[5px] border border-line bg-elevated px-6.25 py-6 text-base text-ink-700">
        {emptyMessage}
      </p>
    );
  }

  return (
    // Scrolls in BOTH axes inside itself, which is what makes the sticky header
    // work: `overflow-x` alone already turns this into a scrollport, so a
    // `sticky top-0` child anchors here rather than to the page — and with no
    // height limit the container never scrolls vertically, so the header never
    // appeared to stick. Capping the height gives it something to stick to.
    //
    // `overflow-x-scroll`, not `auto`: the horizontal bar is the only sign that
    // the table has more columns to the right, so it is always there rather
    // than appearing once the user has already guessed. `scrollbar-table`
    // makes it a solid, grabbable bar instead of a hairline.
    <div className="max-h-[70vh] w-full overflow-x-scroll overflow-y-auto rounded-[10px] border border-line shadow-[0_1px_2px_rgba(30,30,30,0.04)] selection:bg-brand selection:text-elevated scrollbar-table">
      <div style={{ minWidth: totalWidth }}>
        {/* Header */}
        {/* Sticky header: the labels stay visible down a long table. z-30 so it
            also covers the sticky first column as it scrolls under. */}
        <div
          className={cn(
            HEADER_HEIGHT,
            "sticky top-0 z-30 flex border-b border-line bg-surface"
          )}
        >
          <div
            style={{ width: INDEX_COLUMN_WIDTH, left: 0 }}
            className="sticky z-10 shrink-0 border-r border-line bg-surface max-md:static"
          />
          {columns.map((column, columnIndex) => (
            <div
              key={column.key}
              style={{
                width: widths[columnIndex],
                ...(columnIndex === 0 ? { left: INDEX_COLUMN_WIDTH } : {}),
              }}
              className={cn(
                "shrink-0 border-r border-line last:border-r-0",
                // The first column identifies the record, so it stays put while
                // the rest scrolls sideways. Sticky is relative to this grid's
                // own scroll container, not the viewport, so the sidebar to the
                // left is never covered. Dropped under md, where the screen is
                // too narrow to give a frozen column away.
                columnIndex === 0 && "sticky z-10 bg-surface max-md:static"
              )}
            >
              <DataTableHeaderCell column={column} />
            </div>
          ))}
          {rowAction ? (
            <div
              style={{ width: actionWidth }}
              className="flex shrink-0 items-center px-6.25 text-base font-medium text-ink-900"
            >
              {rowAction.label}
            </div>
          ) : null}
        </div>

        {/* Records */}
        {rows.map((row, rowIndex) => {
          const rowId = rowIds[rowIndex];
          const isPending = pending.has(rowId);
          const hasError = failed.has(rowId);

          return (
            <div
              key={rowId}
              className={cn(rowHeight, "flex border-b border-line")}
            >
              <div
                style={{ width: INDEX_COLUMN_WIDTH, left: 0 }}
                className={cn(
                  "sticky z-10 flex shrink-0 items-center justify-center border-r border-line bg-elevated text-base font-normal text-ink-700 max-md:static",
                  // A thin bar on the row number is the whole status language:
                  // it never moves the grid and it survives horizontal scroll.
                  hasError && "border-l-3 border-l-destructive",
                  !hasError && isPending && "border-l-3 border-l-brand"
                )}
              >
                {rowIndex + 1}
              </div>
              {columns.map((column, columnIndex) => (
                <div
                  key={column.key}
                  style={{
                    width: widths[columnIndex],
                    ...(columnIndex === 0 ? { left: INDEX_COLUMN_WIDTH } : {}),
                  }}
                  className={cn(
                    "shrink-0 border-r border-line bg-elevated last:border-r-0",
                    columnIndex === 0 && "sticky z-10 max-md:static"
                  )}
                >
                  <EditableCell
                    column={column}
                    value={valueFor(rowIndex, column)}
                    // The frozen first column is the record's name; it carries
                    // the row the way the header carries the table.
                    emphasized={columnIndex === 0}
                    // Read through valueFor, so the line under a project's name
                    // follows an edit to its city before the server confirms it.
                    subtitle={buildSubtitle(
                      // A column naming itself would print its value twice.
                      column.subtitle?.filter((key) => key !== column.key),
                      (key) => valueForKey(rowIndex, key),
                      columns
                    )}
                    onCommit={(value) => handleCommit(rowIndex, column, value)}
                  />
                </div>
              ))}
              {rowAction ? (
                <div
                  style={{ width: actionWidth }}
                  className="flex shrink-0 items-center bg-elevated px-6.25"
                >
                  {rowAction.render(row)}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
