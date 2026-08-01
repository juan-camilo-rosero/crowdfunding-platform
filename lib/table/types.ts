import type { ColumnDataType } from "./column-types";

/**
 * A choice for `select` columns. A plain string is both the stored value and
 * the label; the object form is for references, where the stored value is an id
 * but the user sees a name.
 */
export type SelectOption = string | { value: string; label: string };

export function optionValue(option: SelectOption): string {
  return typeof option === "string" ? option : option.value;
}

export function optionLabel(option: SelectOption): string {
  return typeof option === "string" ? option : option.label;
}

/**
 * Column definition consumed by EditableDataTable.
 *
 * Deliberately 100% SERIALIZABLE (no functions, no components): a Server
 * Component builds these and passes them to the client table across the RSC
 * boundary. The icon and input are resolved from `type` on the client side.
 */
export type TableColumn = {
  /** Key used to read the value out of each row. */
  key: string;
  /** Header label. */
  label: string;
  /** Drives the header icon, the edit control, the alignment and validation. */
  type: ColumnDataType;
  /** Column width in px. Defaults to a width derived from the type. */
  width?: number;
  /** Choices for `type: "select"`. */
  options?: readonly SelectOption[];
  /** Must carry a value when CREATING a record. Ignored on updates. */
  required?: boolean;
  /**
   * Never editable from the table. Enforced on the server too, so a crafted
   * payload cannot write it (e.g. Solicitudes.status, which must go through the
   * approvals flow so the reassignment transaction gets created).
   */
  readOnly?: boolean;
};

/** One record. Keys match `TableColumn.key`. */
export type TableRow = Record<string, unknown>;

/** A pending edit to an existing record. */
export type RowUpdate = {
  id: string;
  values: Record<string, string>;
};

/** A record being created. */
export type RowInsert = Record<string, string>;

/** Everything the save layer needs for one batch. */
export type TableChanges = {
  updates: RowUpdate[];
  inserts: RowInsert[];
};
