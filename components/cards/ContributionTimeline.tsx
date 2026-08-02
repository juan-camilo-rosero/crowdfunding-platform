import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TimelineEntry = {
  id: string;
  /** Highlighted lead, e.g. a formatted date. Use lib/format upstream. */
  heading: string;
  /** Body line describing what happened. */
  detail: string;
};

export type ContributionTimelineProps = {
  entries: TimelineEntry[];
  /** Rendered instead of the list when there is nothing to show. */
  emptyState?: ReactNode;
  /**
   * Controls the scroll container's height. Passing a value REPLACES the
   * default cap, so a caller can hand it `min-h-0 flex-1` to fill a fixed-height
   * card instead. The list always scrolls past whatever height it ends up with.
   */
  className?: string;
};

/**
 * Vertical timeline: a rail with one node per entry, each row a rounded strip.
 *
 * Generic on purpose — it only knows `heading` + `detail`, so any feed
 * (contributions, reports, milestones) can reuse it.
 */
export function ContributionTimeline({
  entries,
  emptyState,
  className,
}: ContributionTimelineProps) {
  if (entries.length === 0) {
    return <div className={className}>{emptyState}</div>;
  }

  return (
    <div className={cn("overflow-y-auto pr-1", className ?? "max-h-64")}>
      {/* The rail is a left border on the container, so it spans every row and
          keeps growing with the list instead of being drawn per item. */}
      <ol className="relative ml-1.5 flex flex-col gap-3 border-l-2 border-zinc-500 pl-4">
        {entries.map((entry) => (
          <li key={entry.id} className="relative">
            {/*
              Hollow node: white fill, thick dark ring, pierced by the rail.
              Careful with the offset — it is relative to this <li>, which
              starts AFTER the list's pl-4, not at the rail:
                rail centre, in <li> coordinates = -(16px padding) - 1px = -17px
                a 10px dot therefore starts at -17 - 5 = -22px  →  -left-5.5
            */}
            <span
              aria-hidden="true"
              className="absolute top-1/2 -left-5.5 size-2.5 -translate-y-1/2 rounded-full border-[3px] border-zinc-500 bg-white"
            />
            <div className="rounded-tr-[10px] rounded-br-[10px] bg-zinc-100 px-4 py-3">
              <p className="text-xs font-semibold text-stone-900">
                {entry.heading}
              </p>
              <p className="mt-0.5 text-xs text-zinc-600">{entry.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
