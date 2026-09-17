"use client";

import { useMemo, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { es } from "@/i18n";
import { getColumnTypeMeta } from "@/lib/table/column-types";
import { toEditableValue } from "@/lib/table/format-cell";
import {
  optionLabel,
  optionValue,
  type SelectOption,
  type TableColumn,
  type TableRow,
} from "@/lib/table/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ValuePill } from "./SelectCell";

export type RecordFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Same definitions the grid uses; read-only columns are left out. */
  columns: TableColumn[];
  /** Values to start from. Creating a record leaves this undefined. */
  initialValues?: TableRow;
  /** "create" sends every filled field; "edit" sends only what changed. */
  mode?: "create" | "edit";
  submitLabel: string;
  submittingLabel: string;
  /** Persists the record. The dialog closes only when this answers ok. */
  onSubmit: (
    values: Record<string, string>
  ) => Promise<{ ok: boolean; error?: string }>;
};

/**
 * One record as a FORM, for creating and for editing.
 *
 * Why it exists: records used to be created by typing into a draft row pinned
 * under the last record of the grid. On a table with two hundred rows and
 * twenty columns that meant scrolling to the bottom, then sideways, filling
 * cells one at a time with no way to see which were required and no label in
 * sight once the header had scrolled away. A form shows every field at once,
 * with its label, its type and its requirement.
 *
 * The same component edits: the admin opens a record from the catalogue and
 * sees exactly the fields the panel would have shown, in the same order. In
 * "edit" it sends only what actually changed, so an untouched field is never
 * rewritten — which also keeps the batch small enough to be worth a single
 * transaction.
 *
 * Validation stays on the SERVER (lib/table/validation.ts). The only check
 * here is `required`, and only to avoid a round trip that would fail anyway.
 */
export function RecordFormDialog({
  open,
  onOpenChange,
  title,
  description,
  columns,
  initialValues,
  mode = "create",
  submitLabel,
  submittingLabel,
  onSubmit,
}: RecordFormDialogProps) {
  const editable = useMemo(
    () => columns.filter((column) => !column.readOnly),
    [columns]
  );

  const initial = useMemo(() => {
    const values: Record<string, string> = {};
    for (const column of editable) {
      values[column.key] = initialValues
        ? toEditableValue(initialValues[column.key], column.type)
        : "";
    }
    return values;
  }, [editable, initialValues]);

  const [values, setValues] = useState<Record<string, string>>(initial);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);

  function setValue(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setMissing((current) => current.filter((item) => item !== key));
  }

  /** Fields that actually go to the server. */
  function payload(): Record<string, string> {
    const result: Record<string, string> = {};

    for (const column of editable) {
      const value = (values[column.key] ?? "").trim();

      if (mode === "edit") {
        // Unchanged fields are left out entirely — including one cleared to
        // "", which IS a change and travels as an empty string the server
        // turns into NULL.
        if (value !== (initial[column.key] ?? "")) result[column.key] = value;
        continue;
      }

      if (value !== "") result[column.key] = value;
    }

    return result;
  }

  async function handleSubmit() {
    setError(null);

    if (mode === "create") {
      const blanks = editable
        .filter((column) => column.required && !(values[column.key] ?? "").trim())
        .map((column) => column.key);

      if (blanks.length > 0) {
        setMissing(blanks);
        setError(
          es.validation.required.replace(
            "{campo}",
            editable.find((column) => column.key === blanks[0])?.label ?? ""
          )
        );
        return;
      }
    }

    const body = payload();
    if (Object.keys(body).length === 0) {
      setError(es.validation.emptyBatch);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onSubmit(body);
      if (!result.ok) {
        setError(result.error ?? es.admin.saveError);
        return;
      }
      onOpenChange(false);
    } catch {
      // A rejected Server Action (network, body limit, a crash) must land as a
      // message, never as a dialog frozen on "Guardando…".
      setError(es.admin.saveError);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isSubmitting && !next) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-3xl gap-5">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (isSubmitting) return;
            void handleSubmit();
          }}
          noValidate
          className="flex flex-col gap-5"
        >
          {/* The form scrolls, the header and the actions do not: on a table
              with twenty columns the submit button must stay reachable. */}
          <div className="grid max-h-[55vh] gap-4 overflow-y-auto pr-1 sm:grid-cols-2 scrollbar-thin">
            {editable.map((column) => (
              <RecordField
                key={column.key}
                column={column}
                value={values[column.key] ?? ""}
                onChange={(value) => setValue(column.key, value)}
                invalid={missing.includes(column.key)}
                showRequired={mode === "create"}
              />
            ))}
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-[5px] bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              {es.common.cancel}
            </Button>
            <Button
              type="submit"
              variant="brand"
              loading={isSubmitting}
              loadingText={submittingLabel}
            >
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type RecordFieldProps = {
  column: TableColumn;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  showRequired: boolean;
};

/** One labelled control, picked from the column type. */
function RecordField({
  column,
  value,
  onChange,
  invalid,
  showRequired,
}: RecordFieldProps) {
  const meta = getColumnTypeMeta(column.type);
  const fieldId = `field-${column.key}`;
  const isWide = column.type === "longText";

  return (
    <div className={cn("flex flex-col gap-1.5", isWide && "sm:col-span-2")}>
      <label
        htmlFor={fieldId}
        className="text-sm font-medium text-ink-900"
      >
        {column.label}
        {showRequired && column.required ? (
          <span className="text-destructive" aria-hidden="true">
            {" *"}
          </span>
        ) : null}
      </label>

      {meta.input === "select" ? (
        <FormSelect
          id={fieldId}
          value={value}
          options={column.options ?? []}
          onChange={onChange}
          invalid={invalid}
        />
      ) : meta.input === "textarea" ? (
        <Textarea
          id={fieldId}
          value={value}
          aria-invalid={invalid || undefined}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-24"
        />
      ) : meta.input === "checkbox" ? (
        <label className="flex h-12 cursor-pointer items-center gap-2 text-sm text-ink-700">
          <Checkbox
            id={fieldId}
            checked={value === "true"}
            onCheckedChange={(checked) => onChange(String(checked === true))}
          />
          {es.admin.form.booleanHint}
        </label>
      ) : (
        <Input
          id={fieldId}
          inputSize="xl"
          type={meta.input}
          value={value}
          aria-invalid={invalid || undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}

/**
 * Select built on the same DropdownMenu the grid's cells use, so a status looks
 * identical in the form and in the table. A native <select> cannot carry the
 * coloured pill, and its options cannot inherit Poppins.
 */
function FormSelect({
  id,
  value,
  options,
  onChange,
  invalid,
}: {
  id: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  invalid: boolean;
}) {
  const entries = options.map((option) => ({
    value: optionValue(option),
    label: optionLabel(option),
  }));
  const selected = entries.find((option) => option.value === value) ?? null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            id={id}
            type="button"
            className={cn(
              "flex h-12 w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-input px-4 text-left text-sm outline-none",
              "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              invalid && "border-destructive ring-3 ring-destructive/20"
            )}
          />
        }
      >
        {selected ? (
          <ValuePill value={selected.label} />
        ) : (
          <span className="text-ink-400">{es.admin.form.selectPlaceholder}</span>
        )}
        <ChevronDownIcon className="size-4 shrink-0 text-ink-500" aria-hidden="true" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
        {/* Clearing matters when editing: a value set by mistake must come off. */}
        <DropdownMenuItem onClick={() => onChange("")}>
          <span className="text-ink-500">{es.admin.form.selectClear}</span>
        </DropdownMenuItem>

        {entries.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onChange(option.value)}
          >
            <ValuePill value={option.label} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
