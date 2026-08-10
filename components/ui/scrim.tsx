"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"

import { cn } from "@/lib/utils"

type ScrimProps = Omit<ButtonPrimitive.Props, "children"> & {
  /** Announced to screen readers. Say what clicking it does, e.g. "Cerrar…". */
  label: string
}

/**
 * Full-screen dimming layer that dismisses what sits above it.
 *
 * A real button rather than a div: clicking a scrim is the most common way to
 * close a panel, so it has to be reachable by keyboard and named to a screen
 * reader. It carries no visual identity of its own — no border, no hover, no
 * focus ring beyond the outline — because the thing it dims is the subject.
 */
function Scrim({ className, label, ...props }: ScrimProps) {
  return (
    <ButtonPrimitive
      data-slot="scrim"
      aria-label={label}
      className={cn(
        "fixed inset-0 cursor-pointer bg-black/40 transition-opacity",
        className
      )}
      {...props}
    />
  )
}

export { Scrim }
