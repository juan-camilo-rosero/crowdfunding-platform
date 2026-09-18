import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TableCellStackProps = {
  /** What the record IS: a name, a title. Set in the strong ink. */
  primary: ReactNode;
  /**
   * What tells it apart from its neighbours: an email, a city, a type. Omitted
   * (null, undefined or "") the cell is a single line, not a line and a gap.
   */
  secondary?: ReactNode;
  /**
   * The primary is a placeholder rather than data — "Sin nombre" — and must
   * not read as though it were somebody's name.
   */
  primaryMuted?: boolean;
  className?: string;
};

/**
 * A two-line cell: the record's name with its distinguishing detail beneath.
 *
 * The reason it exists is not decoration. Two people can share a name and two
 * projects can share a street; the admin telling them apart used to read across
 * to another column — or, in a grid twenty columns wide, scroll sideways and
 * lose the row. Carrying the detail under the name keeps the identity of the
 * record in one place, which is what the eye is looking at anyway.
 *
 * Both lines truncate rather than wrap, so a long email never makes one row
 * taller than the rest.
 */
export function TableCellStack({
  primary,
  secondary,
  primaryMuted = false,
  className,
}: TableCellStackProps) {
  const hasSecondary =
    secondary !== null && secondary !== undefined && secondary !== "";

  return (
    <div className={cn("flex min-w-0 flex-col justify-center", className)}>
      <span
        className={cn(
          "truncate text-base leading-5",
          primaryMuted ? "font-normal text-ink-400" : "font-medium text-ink-900"
        )}
      >
        {primary}
      </span>
      {hasSecondary ? (
        <span className="truncate text-sm leading-[18px] font-normal text-ink-500">
          {secondary}
        </span>
      ) : null}
    </div>
  );
}
