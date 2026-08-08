"use client";

import { useMemo, useState, type ReactNode } from "react";
import { PlusIcon } from "lucide-react";
import { resolveColumnWidth } from "@/lib/table/format-cell";
import type { TableChanges, TableColumn, TableRow } from "@/lib/table/types";
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
   * Reports the full pending batch (updates + inserts) after every change, so
   * the caller can enable its save button and hand the batch to the server.
   */
  onChangesChange?: (changes: TableChanges) => void;
  /** Renders the trailing draft row that creates records. */
  showNewRecordRow?: boolean;
  /**
   * Optional trailing column holding a control per EXISTING record — the
   * projects tab uses it to open the photo manager.
   *
   * Deliberately a render prop rather than a new column type: what goes in it
   * is a client component with its own state, which a serializable
   * TableColumn cannot describe. It is absent from the draft row, since a
   * record that has not been created yet has no id to act on.
   */
  rowAction?: { label: string; width?: number; render: (row: TableRow) => ReactNode };
  emptyMessage?: string;
};

/**
 * Airtable-style editable grid, reusable for any table in the app.
 *
 * One single grid: the row-number column is the first column, not a separate
 * block. Only the whole grid scrolls horizontally, and it is the one section
 * allowed to exceed the protected content width.
 *
 * Editing is per cell (double click; single click on `select` columns). Changes
 * accumulate LOCALLY and are reported through `onChangesChange`; the caller
 * decides when to persist them (batch save).
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
  onChangesChange,
  showNewRecordRow = true,
  rowAction,
  emptyMessage = "No hay registros todavía.",
}: EditableDataTableProps) {
  /** Pending cell edits, grouped by row id then column. */
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});
  /** Rows created locally from the draft row; they become INSERTs on save. */
  const [createdRows, setCreatedRows] = useState<TableRow[]>([]);
  /** Values typed into the draft row before it becomes a record. */
  const [draft, setDraft] = useState<TableRow>({});

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

  const allRows = useMemo(() => [...rows, ...createdRows], [rows, createdRows]);

  const rowIds = useMemo(
    () => allRows.map((row, index) => String(row[rowIdKey] ?? "row-" + index)),
    [allRows, rowIdKey]
  );

  /** Ids that already exist in the database, as opposed to local drafts. */
  const persistedIds = useMemo(
    () =>
      new Set(rows.map((row, index) => String(row[rowIdKey] ?? "row-" + index))),
    [rows, rowIdKey]
  );

  /**
   * Turns local state into the batch the server expects: edits to persisted
   * rows are UPDATEs, locally created rows (with their later edits merged) are
   * INSERTs. Local ids never leave the client.
   */
  function computeChanges(
    nextEdits: Record<string, Record<string, string>>,
    nextCreated: TableRow[]
  ): TableChanges {
    const updates = Object.entries(nextEdits)
      .filter(([rowId]) => persistedIds.has(rowId))
      .map(([rowId, values]) => ({ id: rowId, values }));

    const inserts = nextCreated.map((row) => {
      const localId = String(row[rowIdKey]);
      const merged: Record<string, string> = {};
      for (const column of columns) {
        const edited = nextEdits[localId]?.[column.key];
        const value = edited !== undefined ? edited : row[column.key];
        if (value !== undefined && value !== null && value !== "") {
          merged[column.key] = String(value);
        }
      }
      return merged;
    });

    return { updates, inserts };
  }

  function valueFor(rowIndex: number, column: TableColumn) {
    const rowId = rowIds[rowIndex];
    const edited = edits[rowId]?.[column.key];
    return edited !== undefined ? edited : allRows[rowIndex][column.key];
  }

  function handleCommit(rowIndex: number, column: TableColumn, value: string) {
    const rowId = rowIds[rowIndex];
    const nextEdits = {
      ...edits,
      [rowId]: { ...(edits[rowId] ?? {}), [column.key]: value },
    };
    setEdits(nextEdits);
    onChangesChange?.(computeChanges(nextEdits, createdRows));
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
      [rowIdKey]: "local-" + createdRows.length,
    };
    const nextCreated = [...createdRows, created];
    setCreatedRows(nextCreated);
    setDraft({});
    onChangesChange?.(computeChanges(edits, nextCreated));
  }

  if (allRows.length === 0 && !showNewRecordRow) {
    return (
      <p className="rounded-[5px] border border-line bg-elevated px-6.25 py-6 text-base text-ink-700">
        {emptyMessage}
      </p>
    );
  }

  return (
    // Scrollbar hidden: it used to overlay the last row. Scroll with a trackpad
    // or shift+wheel.
    // Scrolls in BOTH axes inside itself, which is what makes the sticky header
    // work: `overflow-x-auto` alone already turns this into a scrollport, so a
    // `sticky top-0` child anchors here rather than to the page — and with no
    // height limit the container never scrolls vertically, so the header never
    // appeared to stick. Capping the height gives it something to stick to.
    <div className="max-h-[70vh] w-full overflow-auto rounded-[5px] border border-line scrollbar-none selection:bg-brand selection:text-elevated">
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
        {allRows.map((_, rowIndex) => (
          <div
            key={rowIds[rowIndex]}
            className={cn(ROW_HEIGHT, "flex border-b border-line")}
          >
            <div
              style={{ width: INDEX_COLUMN_WIDTH, left: 0 }}
              className="sticky z-10 flex shrink-0 items-center justify-center border-r border-line bg-elevated text-base font-normal text-ink-700 max-md:static"
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
                  onCommit={(value) => handleCommit(rowIndex, column, value)}
                />
              </div>
            ))}
            {rowAction ? (
              <div
                style={{ width: actionWidth }}
                className="flex shrink-0 items-center bg-elevated px-6.25"
              >
                {/* Only for records that exist: a draft row has no id yet. */}
                {rowIndex < rows.length ? rowAction.render(allRows[rowIndex]) : null}
              </div>
            ) : null}
          </div>
        ))}

        {/* Draft row — fill any cell to create a record. */}
        {showNewRecordRow ? (
          <div
            // Remounting on every creation clears the inputs.
            key={"draft-" + createdRows.length}
            className={cn(ROW_HEIGHT, "flex")}
          >
            <div
              style={{ width: INDEX_COLUMN_WIDTH, left: 0 }}
              className="sticky z-10 flex shrink-0 items-center justify-center border-r border-line bg-elevated text-ink-700 max-md:static"
            >
              <PlusIcon className="size-4" aria-hidden="true" />
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
                  value={draft[column.key] ?? ""}
                  onCommit={(value) => handleDraftCommit(column, value)}
                />
              </div>
            ))}
            {rowAction ? (
              <div
                style={{ width: actionWidth }}
                className="shrink-0 bg-elevated"
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
