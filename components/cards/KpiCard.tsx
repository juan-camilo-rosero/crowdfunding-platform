import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type KpiCardProps = {
  /** Small label above the figure. */
  title: string;
  /** The figure itself, already formatted (use lib/format upstream). */
  value: string;
  /** Supporting line under the figure. */
  description: string;
  /** Icon element shown inside the circle, top-right. Pass a lucide icon. */
  icon: ReactNode;
  /**
   * "featured" is the dark card that opens the row; "default" is the light one.
   * Only colours change — the structure is identical.
   */
  variant?: "featured" | "default";
  className?: string;
};

/**
 * KPI tile: title top-left, circled icon top-right, big figure, description.
 *
 * Presentational only — it never formats or computes anything, so it can be
 * reused by any screen that needs a headline figure.
 */
export function KpiCard({
  title,
  value,
  description,
  icon,
  variant = "default",
  className,
}: KpiCardProps) {
  const isFeatured = variant === "featured";

  return (
    <div
      className={cn(
        // Width comes from the grid cell, never from the card: that is what
        // lets a row hold exact quarters, thirds or halves.
        "flex h-36 w-full flex-col justify-between rounded-[10px] border border-neutral-200 p-4",
        isFeatured ? "bg-stone-900" : "bg-stone-50",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            "text-sm font-medium",
            isFeatured ? "text-stone-50" : "text-zinc-500"
          )}
        >
          {title}
        </p>

        <span
          aria-hidden="true"
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full",
            isFeatured
              ? "bg-zinc-100/5 text-stone-50"
              : "bg-zinc-100 text-zinc-500",
            "[&_svg]:size-4"
          )}
        >
          {icon}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <p
          className={cn(
            "text-3xl font-medium",
            isFeatured ? "text-amber-300" : "text-stone-900"
          )}
        >
          {value}
        </p>
        <p
          className={cn(
            "text-xs",
            isFeatured ? "text-zinc-100 opacity-75" : "text-zinc-500"
          )}
        >
          {description}
        </p>
      </div>
    </div>
  );
}
