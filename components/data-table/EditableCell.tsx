"use client";

import { useEffect, useRef, useState } from "react";
import { PencilIcon } from "lucide-react";
import { es } from "@/i18n";
import { getColumnTypeMeta } from "@/lib/table/column-types";
import { formatCellValue, toEditableValue } from "@/lib/table/format-cell";
import type { TableColumn } from "@/lib/table/types";
import { cn } from "@/lib/utils";
import { TableCellStack } from "@/components/tables/TableCellStack";
import { SelectCell } from "./SelectCell";

export type EditableCellProps = {
  column: TableColumn;
  value: unknown;
  /** Called on commit (blur or Enter). Not called when the value is unchanged. */
  onCommit: (value: string) => void;
  /** Read-only cells never enter edit mode. */
  readOnly?: boolean;
  /**
   * The cell belongs to the column that IDENTIFIES the record, so it is set in
   * the darker ink. On a table twenty columns wide, that is what lets the eye
   * find which row it is on after scrolling sideways.
   */
  emphasized?: boolean;
  /**
   * Second line under the value, already built from the record's other fields
   * (see buildSubtitle). Only honoured when the column declares a `subtitle`,
   * and only for text-like columns: a pill or a checkbox has no "line" to put
   * it under. An empty string still makes the cell two-line-capable — it just
   * shows the one line there is, centred in the taller row.
   */
  subtitle?: string;
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
 * on screen said a cell could be edited, so the grid read as a report. It opens
 * on double click (the grid convention) and on the pencil that appears on
 * hover — a REAL button, so one click opens the editor and the keyboard reaches
 * it with Tab and Enter like any other control. The single click on the cell
 * itself is left alone deliberately: it is what selects text to copy, and
 * taking it away broke reading one table to fill in another.
 *
 * The cell owns no data — the parent table holds the value.
 */
export function EditableCell({
  column,
  value,
  onCommit,
  readOnly = false,
  emphasized = false,
  subtitle = "",
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

  /**
   * Two lines: the value with the record's distinguishing detail beneath.
   * Textareas and checkboxes are excluded on purpose — the first opens as an
   * overlay and the second is a box, and neither has a line to sit above
   * another one.
   */
  const isStacked =
    !!column.subtitle?.length &&
    meta.input !== "textarea" &&
    meta.input !== "checkbox";

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
        className={cn(
          "group/cell flex h-full items-center gap-1 px-6.25 text-base font-normal text-ink-700",
          emphasized && "font-medium text-ink-900",
          !isLocked && "cursor-text hover:bg-surface",
          meta.align === "right" && "justify-end"
        )}
      >
        {isStacked ? (
          <TableCellStack
            className="flex-1"
            // An empty name would leave the first line blank with the detail
            // floating under nothing; a dash says the value is missing.
            primary={text || "—"}
            primaryMuted={!text}
            secondary={subtitle}
          />
        ) : (
          <span className="min-w-0 truncate">{text}</span>
        )}

        {/*
          The affordance, and a real control: it appears on hover or keyboard
          focus and opening the editor is a plain click on it, so the double
          click is a shortcut rather than the only way in. It is also what puts
          every editable cell in the tab order, with a name a screen reader can
          announce — which a div with role="button" never did as well.

          It keeps its space in the layout while invisible, so showing it never
          shifts the value under the pointer.
        */}
        {isLocked ? null : (
          <button
            type="button"
            onClick={startEditing}
            aria-label={`${es.admin.editCell.replace("{campo}", column.label)}: ${
              text || es.admin.emptyValue
            }`}
            className={cn(
              "ml-auto flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-[5px]",
              "text-ink-400 opacity-0 transition-[opacity,background-color,color] outline-none",
              "hover:bg-line hover:text-ink-900",
              "group-hover/cell:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50"
            )}
          >
            <PencilIcon className="size-3.5" aria-hidden="true" />
          </button>
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

  if (isStacked) {
    return (
      // Editing a two-line cell edits the FIRST line only. The detail stays in
      // view underneath, so the admin still sees which record this is while
      // the name is half typed — the whole reason the second line exists. The
      // field gets a visible outline because, unlike a one-line cell, it no
      // longer fills the cell and would otherwise not read as a field at all.
      <div className="flex h-full min-w-0 flex-col justify-center gap-0.5 px-6.25">
        <input
          ref={inputRef as React.Ref<HTMLInputElement>}
          type={meta.input}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          aria-label={column.label}
          className={cn(
            "-mx-1.5 h-6 min-w-0 rounded-[5px] bg-elevated px-1.5 text-base leading-5 font-medium text-ink-900",
            "ring-1 ring-brand outline-none",
            meta.align === "right" && "text-right"
          )}
        />
        {subtitle ? (
          <span className="truncate text-sm leading-[18px] text-ink-500">
            {subtitle}
          </span>
        ) : null}
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
