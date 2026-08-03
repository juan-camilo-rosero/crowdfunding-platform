import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type FormFieldProps = {
  /** Visible label, tied to the control through `htmlFor`. */
  label: string;
  htmlFor: string;
  /** Inline message under the control; the field is styled as invalid with it. */
  error?: string;
  children: ReactNode;
  className?: string;
};

/**
 * Label + control + inline error, in the one arrangement every field uses.
 *
 * The error lives under its own field rather than in a summary at the top, so
 * the fix is always next to the problem. It is announced politely: it appears
 * while the user is elsewhere in the form, and should not interrupt them.
 */
export function FormField({
  label,
  htmlFor,
  error,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink-700">
        {label}
      </label>

      {children}

      {error ? (
        <p
          id={`${htmlFor}-error`}
          role="alert"
          aria-live="polite"
          className="text-xs text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
