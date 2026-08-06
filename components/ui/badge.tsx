import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Status chip.
 *
 * Colour comes from the semantic status tokens in globals.css, never from raw
 * Tailwind palette classes or inline hex — so "approved" is the same green
 * wherever it appears, and one token change restyles every screen.
 *
 * This is NOT ValuePill (components/data-table). That one derives a colour by
 * HASHING the string, which is right for open-ended enums where any stable
 * colour will do; here the three states have meanings — green, amber, red — and
 * a hash cannot be relied on to produce them.
 *
 * The label is always rendered next to the dot: colour alone is not an
 * accessible way to convey state.
 */
const badgeVariants = cva(
  "inline-flex min-w-0 items-center gap-2 rounded-full px-2.5 py-1 text-sm font-medium",
  {
    variants: {
      variant: {
        success: "bg-status-success text-status-success-foreground",
        warning: "bg-status-warning text-status-warning-foreground",
        danger: "bg-status-danger text-status-danger-foreground",
        neutral: "bg-status-neutral text-status-neutral-foreground",
      },
      /** A leading dot echoes the colour at higher contrast. */
      dot: { true: "", false: "" },
    },
    defaultVariants: { variant: "neutral", dot: true },
  }
);

export type BadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants>;

function Badge({ className, variant, dot = true, children, ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      data-variant={variant ?? "neutral"}
      className={cn(badgeVariants({ variant, dot, className }))}
      {...props}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className="size-2 shrink-0 rounded-full bg-current"
        />
      ) : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

export { Badge, badgeVariants };
