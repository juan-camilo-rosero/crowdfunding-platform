import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const inputVariants = cva(
  "w-full min-w-0 rounded-lg border border-input bg-transparent text-base text-ink-900 transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-ink-400 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
  {
    variants: {
      inputSize: {
        default: "h-8 px-2.5 py-1",
        /**
         * Form-sized control, matches Button's `xl`. Design: 14px placeholder;
         * kept at 16px under md so iOS does not zoom the field on focus.
         */
        xl: "h-12 rounded-xl px-4 md:text-sm",
      },
      hasIcon: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      { inputSize: "default", hasIcon: true, className: "pl-9" },
      { inputSize: "xl", hasIcon: true, className: "pl-11" },
    ],
    defaultVariants: { inputSize: "default", hasIcon: false },
  }
)

type InputProps = React.ComponentProps<"input"> &
  Omit<VariantProps<typeof inputVariants>, "hasIcon"> & {
    /** Decorative icon rendered inside the field, at the inline start. */
    icon?: React.ReactNode
  }

function Input({ className, type, inputSize, icon, ...props }: InputProps) {
  const field = (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(inputVariants({ inputSize, hasIcon: !!icon, className }))}
      {...props}
    />
  )

  if (!icon) return field

  return (
    <div data-slot="input-wrapper" className="relative w-full">
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 flex items-center text-muted-foreground [&_svg]:size-5",
          inputSize === "xl" ? "left-4" : "left-2.5"
        )}
      >
        {icon}
      </span>
      {field}
    </div>
  )
}

export { Input, inputVariants }
export type { InputProps }
