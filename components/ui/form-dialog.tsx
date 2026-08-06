"use client";

import type { ReactNode } from "react";
import { es } from "@/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type FormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** One line under the title saying what the form is for. */
  description?: string;
  /** The fields. The shell owns the frame, never the contents. */
  children: ReactNode;
  /** Called on submit; the shell handles preventDefault. */
  onSubmit: () => void;
  submitLabel: string;
  /** Shown inside the submit button while `isSubmitting`. */
  submittingLabel: string;
  cancelLabel?: string;
  isSubmitting?: boolean;
  /** Blocks submission — invalid form, nothing to submit, etc. */
  submitDisabled?: boolean;
  /** Error banner above the actions. Cleared and set by the caller. */
  error?: string | null;
  /** Small print under the actions: disclaimers, legal framing. */
  footnote?: ReactNode;
  className?: string;
};

/**
 * Shell for any modal form: title, description, fields, actions, error banner
 * and a footnote slot.
 *
 * Built to be reused, not tailored to one screen — the reassignment request is
 * simply its first caller, and "Me interesa este proyecto" is meant to be the
 * next. It owns the FRAME and the submit lifecycle; the caller owns the fields
 * and the validation, which is why `children` is opaque to it.
 *
 * Accessibility comes from the Dialog primitive underneath: focus trapping,
 * focus restored to the trigger on close, Escape, aria-modal. The submit
 * control is a real form submit, so Enter works from any field.
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  submitLabel,
  submittingLabel,
  cancelLabel,
  isSubmitting = false,
  submitDisabled = false,
  error,
  footnote,
  className,
}: FormDialogProps) {
  return (
    <Dialog
      open={open}
      // A submit in flight must not be abandoned halfway.
      onOpenChange={(next) => {
        if (isSubmitting && !next) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className={cn("gap-5", className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (isSubmitting || submitDisabled) return;
            onSubmit();
          }}
          noValidate
          className="flex flex-col gap-5"
        >
          <div className="flex flex-col gap-4">{children}</div>

          {error ? (
            <p
              role="alert"
              className="rounded-[5px] bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <DialogClose
              render={
                <Button type="button" variant="ghost" disabled={isSubmitting}>
                  {cancelLabel ?? es.common.cancel}
                </Button>
              }
            />
            <Button
              type="submit"
              variant="brand"
              loading={isSubmitting}
              loadingText={submittingLabel}
              disabled={submitDisabled}
            >
              {submitLabel}
            </Button>
          </DialogFooter>

          {footnote ? (
            <p className="text-xs text-ink-400">{footnote}</p>
          ) : null}
        </form>
      </DialogContent>
    </Dialog>
  );
}
