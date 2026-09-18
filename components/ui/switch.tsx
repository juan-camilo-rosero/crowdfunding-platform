"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

/**
 * On/off switch, on Base UI like every other control here.
 *
 * The right control for a yes/no FIELD: unlike a checkbox it reads as a state
 * that takes effect, and its two positions are distinguishable at a glance
 * down a column of forty rows. The primitive renders a real
 * `<button role="switch" aria-checked>`, so keyboard (Space/Enter) and screen
 * readers work without anything reimplemented here.
 *
 * It carries no label of its own — the caller gives it an accessible name —
 * and no text: whoever places it decides whether a "Sí/No" beside it helps.
 *
 * Design: 36×20 track, brand fill when on, #E2E2E2 when off; 16px white thumb.
 */
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-line transition-colors outline-none",
        "focus-visible:ring-3 focus-visible:ring-ring/50",
        "data-checked:bg-brand",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-4 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform duration-150 data-checked:translate-x-[18px]"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
