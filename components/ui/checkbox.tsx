"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Tick box, on Base UI like every other control here.
 *
 * Built rather than hand-rolled with a bare <input>: the primitive renders a
 * real hidden input beside the box, so it takes part in forms, keyboard
 * navigation and screen-reader output — the parts a styled <div> silently
 * drops. It carries no label of its own; the caller wraps it in one, which is
 * what lets a whole row be the click target.
 */
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "flex size-4.5 shrink-0 cursor-pointer items-center justify-center rounded-[5px] border border-input bg-transparent text-brand-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-checked:border-brand data-checked:bg-brand",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current"
      >
        <CheckIcon className="size-3" strokeWidth={3} aria-hidden="true" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
