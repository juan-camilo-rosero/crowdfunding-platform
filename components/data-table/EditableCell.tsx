"use client";

import { useEffect, useRef, useState } from "react";
import { PencilIcon } from "lucide-react";
import { es } from "@/i18n";
import { getColumnTypeMeta } from "@/lib/table/column-types";
import { formatCellValue, toEditableValue } from "@/lib/table/format-cell";
import type { TableColumn } from "@/lib/table/types";
import { cn } from "@/lib/utils";
import { SelectCell } from "./SelectCell";

export type EditableCellProps = {
  column: TableColumn;
  value: unknown;
  /** Called on commit (blur or Enter). Not called when the value is unchanged. */
  onCommit: (value: string) => void;
  /** Read-only cells never enter edit mode. */
  readOnly?: boolean;
};

/**
 * A single table cell.
 *
 * Reads as plain text until it is opened for editing, at which point it swaps
 * for the input matching the column type. Blur or Enter commits, Escape
 * discards. `select` columns are delegated to SelectCell, which opens on a
 * single click.
 *
 * HOW IT OPENS matters, and it is why this is not just a double click: nothing
 * on screen said a cell could be edited, so the grid read as a report. It now
 * opens on double click (the grid convention), on Enter or F2 when focused, and
 * every editable cell is reachable with Tab and shows a pencil on hover. The
 * single click is left alone deliberately — it is what selects text to copy,
 * and taking it away broke reading the table to fill in another one.
 *
 * The cell owns no data — the parent table holds the value.
 */
export function EditableCell({
  column,
  value,
  onCommit,
  readOnly = false,
}: EditableCellProps) {
  const meta = getColumnTypeMeta(column.type);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isEditing) return;
    const node = inputRef.current;
    node?.focus();
    node?.select();
  }, [isEditing]);

  const isLocked = readOnly || column.readOnly === true;

  // Select columns get their own always-interactive control.
  if (meta.input === "select") {
    return (
      <SelectCell
        value={value == null ? "" : String(value)}
        options={column.options ?? []}
        onChange={onCommit}
        readOnly={isLocked}
      />
    );
  }

  function startEditing() {
    if (isLocked) return;
    setDraft(toEditableValue(value, column.type));
    setIsEditing(true);
  }

  function commit() {
    setIsEditing(false);
    if (draft !== toEditableValue(value, column.type)) onCommit(draft);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    // A long text needs Enter for line breaks; Ctrl/Cmd+Enter commits instead.
    const commitsOnEnter = column.type !== "longText" || event.ctrlKey || event.metaKey;

    if (event.key === "Enter" && commitsOnEnter) {
      event.preventDefault();
      commit();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setIsEditing(false);
    }
  }

  // Design: 41px tall, 25px inline padding, 16px / weight 400 / #585858.
  const shared =
    "h-full w-full bg-transparent px-6.25 text-base font-normal text-ink-700 outline-none";

  if (!isEditing) {
    const text = formatCellValue(value, column.type);

    return (
      // No `title`: the native tooltip duplicated the visible text.
      <div
        onDoubleClick={startEditing}
        onKeyDown={(event) => {
          if (isLocked) return;
          if (event.key === "Enter" || event.key === "F2") {
            event.preventDefault();
            startEditing();
          }
        }}
        // Locked cells stay out of the tab order: there is nothing to open.
        tabIndex={isLocked ? undefined : 0}
        role={isLocked ? undefined : "button"}
        aria-label={
          isLocked ? undefined : `${column.label}: ${text || es.admin.emptyValue}`
        }
        className={cn(
          "group/cell flex h-full items-center gap-1 px-6.25 text-base font-normal text-ink-700 outline-none",
          !isLocked &&
            "cursor-text hover:bg-surface focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
          meta.align === "right" && "justify-end"
        )}
      >
        <span className="min-w-0 truncate">{text}</span>

        {/* The affordance: shows on hover or keyboard focus, never at rest. */}
        {isLocked ? null : (
          <PencilIcon
            aria-hidden="true"
            className="ml-auto size-3.5 shrink-0 text-ink-400 opacity-0 transition-opacity group-hover/cell:opacity-100 group-focus-visible/cell:opacity-100"
          />
        )}
      </div>
    );
  }

  if (meta.input === "checkbox") {
    return (
      <div className="flex h-full items-center px-6.25">
        <input
          ref={inputRef as React.Ref<HTMLInputElement>}
          type="checkbox"
          checked={draft === "true"}
          onChange={(event) => setDraft(String(event.target.checked))}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="size-4 cursor-pointer accent-brand"
        />
      </div>
    );
  }

  if (meta.input === "textarea") {
    return (
      // Long prose in a 41px row meant editing a paragraph through a slot. The
      // editor lifts out of the row instead, over the rows below, and the cell
      // keeps its height so nothing around it moves.
      <div className="relative h-full">
        <textarea
          ref={inputRef as React.Ref<HTMLTextAreaElement>}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          rows={4}
          className={cn(
            "absolute top-0 left-0 z-20 min-h-32 w-full min-w-full resize-none rounded-[5px]",
            "border border-brand bg-elevated px-6.25 py-2.5 text-base font-normal",
            "leading-snug text-ink-700 shadow-lg outline-none"
          )}
        />
      </div>
    );
  }

  return (
    <input
      ref={inputRef as React.Ref<HTMLInputElement>}
      type={meta.input}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      className={cn(shared, meta.align === "right" && "text-right")}
    />
  );
}
