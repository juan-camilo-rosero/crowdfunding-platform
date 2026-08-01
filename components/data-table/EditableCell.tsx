"use client";

import { useEffect, useRef, useState } from "react";
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
 * Reads as plain text until it is DOUBLE-CLICKED, at which point it swaps for
 * the input matching the column type. Blur or Enter commits, Escape discards.
 * `select` columns are delegated to SelectCell, which opens on a single click.
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
    if (event.key === "Enter" && column.type !== "longText") {
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
    return (
      // No `title`: the native tooltip duplicated the visible text.
      <div
        onDoubleClick={startEditing}
        className={cn(
          "flex h-full items-center truncate px-6.25 text-base font-normal text-ink-700",
          meta.align === "right" && "justify-end"
        )}
      >
        {formatCellValue(value, column.type)}
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
      <textarea
        ref={inputRef as React.Ref<HTMLTextAreaElement>}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        rows={1}
        className={cn(shared, "resize-none py-2.5 leading-tight")}
      />
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
