"use client";

import * as React from "react";
import { EyeIcon, EyeOffIcon, LockIcon } from "lucide-react";
import { es } from "@/i18n";
import { cn } from "@/lib/utils";
import { Input, type InputProps } from "@/components/ui/input";

export type PasswordInputProps = Omit<InputProps, "type" | "icon"> & {
  /** Leading icon. Defaults to a padlock, matching the mail icon on email. */
  icon?: React.ReactNode;
};

/**
 * Password field with a show/hide toggle.
 *
 * Wraps the project's Input rather than reimplementing one, so the border,
 * sizes, focus ring and placeholder colour stay identical to every other field.
 * The only thing added is the trailing control.
 *
 * That control is `type="button"` on purpose: inside a form, a button with no
 * type submits it, so revealing the password would have sent the form.
 */
function PasswordInput({
  className,
  icon,
  inputSize = "xl",
  ...props
}: PasswordInputProps) {
  const [isVisible, setIsVisible] = React.useState(false);

  return (
    <div className="relative w-full">
      <Input
        {...props}
        type={isVisible ? "text" : "password"}
        inputSize={inputSize}
        icon={icon ?? <LockIcon />}
        // Room for the toggle, so a long password never runs under it.
        className={cn("pr-11", className)}
      />

      <button
        type="button"
        onClick={() => setIsVisible((visible) => !visible)}
        aria-label={
          isVisible ? es.auth.hidePassword : es.auth.showPassword
        }
        aria-pressed={isVisible}
        className={cn(
          "absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center",
          "text-ink-500 transition-colors hover:text-ink-900",
          props.disabled && "pointer-events-none opacity-50"
        )}
      >
        {isVisible ? (
          <EyeOffIcon className="size-5" aria-hidden="true" />
        ) : (
          <EyeIcon className="size-5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

export { PasswordInput };
