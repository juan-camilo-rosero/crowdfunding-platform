import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const textareaVariants = cva(
  // Mirrors Input's look so a multi-line field is not a different-looking
  // control. `field-sizing-content` grows the box with the text; `max-h` stops
  // it from eating the panel it lives in.
  "w-full min-w-0 resize-none rounded-lg border border-input bg-transparent text-base text-ink-900 transition-colors outline-none field-sizing-content placeholder:text-ink-400 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm",
  {
    variants: {
      textareaSize: {
        default: "min-h-16 px-2.5 py-1.5",
        /** Composer field: one line at rest, grows to a few. */
        compact: "min-h-9 max-h-32 px-3 py-2",
      },
    },
    defaultVariants: { textareaSize: "default" },
  }
)

type TextareaProps = React.ComponentProps<"textarea"> &
  VariantProps<typeof textareaVariants>

function Textarea({ className, textareaSize, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(textareaVariants({ textareaSize, className }))}
      {...props}
    />
  )
}

export { Textarea, textareaVariants }
export type { TextareaProps }
