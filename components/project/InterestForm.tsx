"use client";

import { useState } from "react";
import {
  BriefcaseIcon,
  CheckCircleIcon,
  DollarSignIcon,
  MessageSquareIcon,
} from "lucide-react";
import { es } from "@/i18n";
import { validateInterest, type InterestErrors } from "@/lib/interests/schema";
import {
  INVESTMENT_TYPE_PREFS,
  type InvestmentTypePref,
} from "@/lib/interests/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/auth/FormField";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { createInvestmentInterest } from "./actions";

export type InterestFormProps = {
  projectId: string;
  className?: string;
};

/**
 * "Me interesa este proyecto" — the inline card in the Resumen column.
 *
 * Inline by design, not a modal: it sits beside the project it refers to, and
 * views.md places it there. If it ever needs to become a modal it would reuse
 * the FormDialog shell rather than grow its own.
 *
 * The confirmation shown on success depends ONLY on the row being saved. Email
 * is fired best-effort by the action and cannot delay or block what the user
 * sees — a team without a mail provider configured still gets working interest
 * capture.
 */
export function InterestForm({ projectId, className }: InterestFormProps) {
  const [amountText, setAmountText] = useState("");
  const [typePref, setTypePref] = useState<InvestmentTypePref | null>(null);
  const [comments, setComments] = useState("");

  const [errors, setErrors] = useState<InterestErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const payload = {
    projectId,
    amount: amountText === "" ? null : Number(amountText),
    investmentTypePref: typePref,
    comments: comments || null,
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const parsed = validateInterest(payload);
    if (!parsed.success) {
      setErrors(parsed.errors);
      return;
    }

    setErrors({});
    setServerError(null);
    setIsSubmitting(true);

    const result = await createInvestmentInterest(payload);

    setIsSubmitting(false);

    if (!result.ok) {
      // The card stays put with the message; nothing typed is lost.
      setServerError(result.error);
      return;
    }

    setIsDone(true);
  }

  function reset() {
    setAmountText("");
    setTypePref(null);
    setComments("");
    setErrors({});
    setServerError(null);
    setIsDone(false);
  }

  const cardClassName = cn(
    "flex flex-col gap-4 rounded-[10px] border border-neutral-200 bg-stone-50 p-6",
    className
  );

  if (isDone) {
    return (
      <div className={cn(cardClassName, "items-center text-center")}>
        <span
          aria-hidden="true"
          className="flex size-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-600"
        >
          <CheckCircleIcon className="size-5" />
        </span>
        <div>
          <p
            role="status"
            className="text-base font-medium text-stone-900"
          >
            {es.projectDetail.interest.successTitle}
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            {es.projectDetail.interest.successHint}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={reset}>
          {es.projectDetail.interest.successAgain}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className={cardClassName}>
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-medium text-stone-900">
          {es.projectDetail.interest.title}
        </h2>
        <p className="text-sm text-zinc-600">
          {es.projectDetail.interest.subtitle}
        </p>
      </div>

      <FormField
        label={es.projectDetail.interest.amountLabel}
        htmlFor="interest-amount"
        error={errors.amount}
      >
        <Input
          id="interest-amount"
          inputSize="xl"
          inputMode="decimal"
          icon={<DollarSignIcon />}
          className="rounded-[5px]"
          placeholder={es.projectDetail.interest.amountPlaceholder}
          value={amountText}
          disabled={isSubmitting}
          aria-invalid={!!errors.amount || undefined}
          // Digits and one decimal point only: no commas, no letters.
          onChange={(event) =>
            setAmountText(
              event.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1")
            )
          }
        />
      </FormField>

      <FormField
        label={es.projectDetail.interest.typeLabel}
        htmlFor="interest-type"
        error={errors.investmentTypePref}
      >
        <FilterDropdown
          icon={<BriefcaseIcon />}
          ariaLabel={es.projectDetail.interest.typeLabel}
          placeholder={es.projectDetail.interest.typePlaceholder}
          clearLabel={es.projectDetail.interest.typePlaceholder}
          options={INVESTMENT_TYPE_PREFS.map((value) => ({
            value,
            label: es.projectDetail.interest.type[value] ?? value,
          }))}
          value={typePref}
          onSelect={(value) => setTypePref(value as InvestmentTypePref | null)}
          className="w-full"
        />
      </FormField>

      <FormField
        label={es.projectDetail.interest.commentsLabel}
        htmlFor="interest-comments"
        error={errors.comments}
      >
        <Input
          id="interest-comments"
          inputSize="xl"
          icon={<MessageSquareIcon />}
          className="rounded-[5px]"
          placeholder={es.projectDetail.interest.commentsPlaceholder}
          value={comments}
          disabled={isSubmitting}
          onChange={(event) => setComments(event.target.value)}
        />
      </FormField>

      {serverError ? (
        <p
          role="alert"
          className="rounded-[5px] bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {serverError}
        </p>
      ) : null}

      <Button
        type="submit"
        size="xl"
        className="w-full rounded-[10px] bg-stone-900 text-stone-50 hover:bg-stone-900/90"
        loading={isSubmitting}
        loadingText={es.projectDetail.interest.pending}
      >
        {es.projectDetail.interest.submit}
      </Button>

      <p className="text-xs text-neutral-400">
        {es.projectDetail.interest.disclaimer}
      </p>
    </form>
  );
}
