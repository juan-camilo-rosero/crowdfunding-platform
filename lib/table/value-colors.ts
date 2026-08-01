/**
 * Deterministic pill colors for enum-ish values.
 *
 * The same value always maps to the same color anywhere in the app, because the
 * index comes from a hash of the string rather than from its position. Reusable
 * outside tables (badges, chips, legends).
 */
export type PillColor = {
  /** Pill background. */
  bg: string;
  /** Dot and label ink. */
  fg: string;
};

const PILL_COLORS: PillColor[] = [
  { bg: "#EAEAFE", fg: "#6366F1" },
  { bg: "#E4F5EA", fg: "#15803D" },
  { bg: "#FDEAEA", fg: "#DC2626" },
  { bg: "#FDF0DC", fg: "#B45309" },
  { bg: "#E3F1FA", fg: "#0369A1" },
  { bg: "#FBE8F3", fg: "#BE185D" },
  { bg: "#EDF3E2", fg: "#4D7C0F" },
  { bg: "#EFEAFA", fg: "#6D28D9" },
  { bg: "#E2F4F3", fg: "#0F766E" },
  { bg: "#F3EDE4", fg: "#78350F" },
];

/** Neutral pill for empty values. */
const EMPTY_COLOR: PillColor = { bg: "#EDEDED", fg: "#585858" };

export function pillColorFor(value: string | null | undefined): PillColor {
  if (!value) return EMPTY_COLOR;

  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return PILL_COLORS[hash % PILL_COLORS.length];
}
