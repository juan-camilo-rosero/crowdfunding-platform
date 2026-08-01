import type { ColumnDataType } from "./column-types";

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
  /** Drives the header icon, the edit control and the alignment. */
  type: ColumnDataType;
  /** Column width in px. Defaults to a width derived from the type. */
  width?: number;
  /** Choices for `type: "select"`. */
  options?: readonly string[];
};

/** One record. Keys match `TableColumn.key`. */
export type TableRow = Record<string, unknown>;

/** Identifies a single cell for edit tracking. */
export type CellAddress = { rowId: string; columnKey: string };
