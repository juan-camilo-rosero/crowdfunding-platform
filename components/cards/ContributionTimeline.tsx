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
 * Vertical timeline: a node per entry with the text block hanging off it.
 *
 * The rail is NOT a border on the list — that would run past the last node down
 * to the bottom of the container. Instead each entry except the last draws its
 * own connector down to the next node, so the line starts at the first node and
 * stops exactly at the last one.
 *
 * Generic on purpose — it only knows `heading` + `detail`, so any feed
 * (contributions, reports, milestones) can reuse it.
 */

/** Distance from an entry's top to its node centre; matches the box's padding. */
const NODE_OFFSET = "top-5";
/**
 * How far the connector runs past the entry: the gap between entries (12px)
 * plus the next node's own offset (20px).
 */
const CONNECTOR_TAIL = "-bottom-8";

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
      {/* ml-2 leaves room for the node, which sits outside the content box. */}
      <ol className="relative ml-2 flex flex-col gap-3">
        {entries.map((entry, index) => (
          <li key={entry.id} className="relative">
            {index < entries.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute -left-0.5 w-0.5 bg-zinc-500",
                  NODE_OFFSET,
                  CONNECTOR_TAIL
                )}
              />
            ) : null}

            {/* Hollow node on the rail; z-10 keeps it above the box it meets. */}
            <span
              aria-hidden="true"
              className={cn(
                "absolute -left-1.5 z-10 size-2.5 -translate-y-1/2 rounded-full border-[3px] border-zinc-500 bg-white",
                NODE_OFFSET
              )}
            />

            {/* Flush against the rail: no left padding between line and box. */}
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
