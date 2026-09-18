"use client";

import { es } from "@/i18n";
import { parseBoolean } from "@/lib/table/boolean";
import { Switch } from "@/components/ui/switch";

export type BooleanCellProps = {
  /** The cell's value in either shape — a boolean, or the edit string "true"/"false". */
  value: unknown;
  /** Receives the new state as the string the batch save carries. */
  onChange: (value: string) => void;
  /** Accessible name; the column label. */
  label: string;
  readOnly?: boolean;
};

/**
 * Cell for `type: "boolean"`.
 *
 * Always a switch, like SelectCell is always a pill: a yes/no needs no "edit
 * mode". One click (or Space) flips it and commits at once — there is nothing
 * to type, so there is nothing to confirm. It used to take a double click to
 * reveal a bare checkbox that saved only on blur, which read as broken.
 *
 * CONTROLLED by `value`: the switch shows what the grid holds, never its own
 * guess. If the grid declines the change (a row with no id cannot be saved),
 * the switch simply does not move.
 *
 * The "Sí"/"No" beside it is not decoration: the state must not rest on colour
 * alone, and it is what a scan down the column actually reads.
 */
export function BooleanCell({
  value,
  onChange,
  label,
  readOnly = false,
}: BooleanCellProps) {
  const checked = parseBoolean(value) === true;

  return (
    <div className="flex h-full items-center gap-2.5 px-6.25">
      <Switch
        checked={checked}
        disabled={readOnly}
        aria-label={label}
        onCheckedChange={(next) => onChange(String(next))}
      />
      <span className="text-base text-ink-700">
        {checked ? es.admin.form.yes : es.admin.form.no}
      </span>
    </div>
  );
}
