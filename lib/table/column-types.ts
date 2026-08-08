import {
  AlignLeftIcon,
  AtSignIcon,
  CalendarIcon,
  CircleDotIcon,
  DollarSignIcon,
  DownloadIcon,
  HomeIcon,
  HashIcon,
  LinkIcon,
  ListIcon,
  PercentIcon,
  SmartphoneIcon,
  ToggleLeftIcon,
  TypeIcon,
  type LucideIcon,
} from "lucide-react";

/**
 * Single source of truth for column data types.
 *
 * Everything a table needs to know about a type lives here: which icon labels
 * it in the header, which input renders while editing, and how the value is
 * aligned. Add a type once and every table in the app gets it.
 */
export type ColumnDataType =
  | "text"
  | "longText"
  | "email"
  | "phone"
  | "url"
  | "number"
  | "currency"
  | "percent"
  | "date"
  | "select"
  | "boolean"
  /**
   * A project's name. Reads and validates exactly like text; it exists so the
   * header carries a building icon instead of the generic "T", which made every
   * project column look like free-form prose.
   */
  | "project"
  /**
   * Column that holds a CONTROL rather than a value — a download button, for
   * instance. Only ReadOnlyDataTable renders it, always through `renderCell`;
   * the editable grid has no reason to declare one, which is why its input kind
   * is a placeholder.
   */
  | "action";

/** HTML input types; "select" and "textarea" are rendered as their own controls. */
export type ColumnInputKind =
  | "text"
  | "email"
  | "tel"
  | "url"
  | "number"
  | "date"
  | "checkbox"
  | "select"
  | "textarea";

export type ColumnTypeMeta = {
  /** Header icon. Represents the TYPE of the column, never the value. */
  icon: LucideIcon;
  /** Control used while the cell is being edited. */
  input: ColumnInputKind;
  /** Numeric-ish values read better right-aligned. */
  align: "left" | "right";
};

export const COLUMN_TYPE_META: Record<ColumnDataType, ColumnTypeMeta> = {
  text: { icon: TypeIcon, input: "text", align: "left" },
  // Multi-line prose: paragraph icon rather than the single-line "type" one.
  longText: { icon: AlignLeftIcon, input: "textarea", align: "left" },
  email: { icon: AtSignIcon, input: "email", align: "left" },
  phone: { icon: SmartphoneIcon, input: "tel", align: "left" },
  // No dedicated "URL" glyph in lucide; the chain link is the closest match.
  url: { icon: LinkIcon, input: "url", align: "left" },
  number: { icon: HashIcon, input: "number", align: "right" },
  currency: { icon: DollarSignIcon, input: "number", align: "right" },
  percent: { icon: PercentIcon, input: "number", align: "right" },
  date: { icon: CalendarIcon, input: "date", align: "left" },
  select: { icon: ListIcon, input: "select", align: "left" },
  // Lucide has no checkbox-ish "boolean" glyph that reads well at 16px;
  // the toggle communicates the two-state nature best.
  boolean: { icon: ToggleLeftIcon, input: "checkbox", align: "left" },
  project: { icon: HomeIcon, input: "text", align: "left" },
  // Never edited: the cell content comes from the caller's renderCell.
  action: { icon: DownloadIcon, input: "text", align: "left" },
};

/** Fallback keeps an unknown type rendering instead of crashing the table. */
const FALLBACK_META: ColumnTypeMeta = {
  icon: CircleDotIcon,
  input: "text",
  align: "left",
};

export function getColumnTypeMeta(type: ColumnDataType): ColumnTypeMeta {
  return COLUMN_TYPE_META[type] ?? FALLBACK_META;
}
