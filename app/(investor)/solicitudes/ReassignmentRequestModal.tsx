"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { es } from "@/i18n";
import { formatCurrency } from "@/lib/format";
import {
  exceedsAvailable,
  validateCreateRequest,
} from "@/lib/requests/create-schema";
import type {
  ReassignmentDestination,
  ReassignmentSource,
} from "@/lib/requests/create-types";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/auth/FormField";
import { FilterDropdown } from "@/components/filters/FilterDropdown";
import { createReassignmentRequest } from "./actions";

export type ReassignmentRequestModalProps = {
  /** Projects with capital available, computed on the server. */
  sources: ReassignmentSource[];
  /** Projects that can receive capital, computed on the server. */
  destinations: ReassignmentDestination[];
};

/**
 * "Nueva solicitud" — the reassignment request form.
 *
 * The options and the available amount shown here are for UX only. The Server
 * Action re-reads both before writing, so a stale or edited value in this
 * component cannot widen what actually gets accepted.
 *
 * The framing matters and is deliberate: this SENDS A REQUEST for the Investors
 * 180 team to review. Nothing here moves capital, and the copy never suggests
 * otherwise.
 */
export function ReassignmentRequestModal({
  sources,
  destinations,
}: ReassignmentRequestModalProps) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [fromProjectId, setFromProjectId] = useState<string | null>(null);
  const [toProjectId, setToProjectId] = useState<string | null>(null);
  const [amountText, setAmountText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const hasCapital = sources.length > 0;

  const selectedSource = useMemo(
    () => sources.find((source) => source.projectId === fromProjectId) ?? null,
    [sources, fromProjectId]
  );

  // A project cannot receive capital from itself.
  const availableDestinations = useMemo(
    () =>
      destinations.filter(
        (destination) => destination.projectId !== fromProjectId
      ),
    [destinations, fromProjectId]
  );

  const amount = amountText === "" ? Number.NaN : Number(amountText);

  /**
   * Live validation. Only surfaces once the field has content, so the form does
   * not scold the user for not having typed yet.
   */
  const amountError = useMemo(() => {
    if (amountText === "") return null;
    if (!Number.isFinite(amount)) return es.requests.errors.amountNumber;
    if (amount <= 0) return es.requests.errors.amountPositive;
    if (
      selectedSource &&
      exceedsAvailable(amount, selectedSource.availableAmount)
    ) {
      return es.requests.errors.amountTooHigh.replace(
        "{amount}",
        formatCurrency(selectedSource.availableAmount)
      );
    }
    return null;
  }, [amountText, amount, selectedSource]);

  const isValid =
    validateCreateRequest({
      fromProjectId: fromProjectId ?? "",
      toProjectId: toProjectId ?? "",
      amount,
    }).success && !amountError;

  function reset() {
    setFromProjectId(null);
    setToProjectId(null);
    setAmountText("");
    setServerError(null);
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setServerError(null);

    const result = await createReassignmentRequest({
      fromProjectId,
      toProjectId,
      amount,
    });

    setIsSubmitting(false);

    if (!result.ok) {
      // The modal stays open with the message, so nothing typed is lost.
      setServerError(result.error);
      return;
    }

    setOpen(false);
    reset();
    // revalidatePath already refreshed the server data; this re-renders it.
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        variant="brand"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <PlusIcon data-icon="inline-start" aria-hidden="true" />
        {es.requests.create.open}
      </Button>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={es.requests.create.title}
        description={es.requests.create.description}
        onSubmit={handleSubmit}
        submitLabel={es.requests.create.submit}
        submittingLabel={es.requests.create.submitting}
        cancelLabel={es.requests.create.cancel}
        isSubmitting={isSubmitting}
        submitDisabled={!hasCapital || !isValid}
        error={serverError}
        footnote={es.requests.create.footnote}
      >
        {!hasCapital ? (
          <div className="rounded-[5px] border border-line bg-surface px-4 py-5 text-center">
            <p className="text-base font-medium text-ink-900">
              {es.requests.create.noCapital}
            </p>
            <p className="mt-1 text-sm text-ink-500">
              {es.requests.create.noCapitalHint}
            </p>
          </div>
        ) : (
          <>
            <FormField
              label={es.requests.create.fromLabel}
              htmlFor="fromProjectId"
            >
              <FilterDropdown
                icon={<span aria-hidden="true" />}
                ariaLabel={es.requests.create.fromLabel}
                placeholder={es.requests.create.fromPlaceholder}
                clearLabel={es.requests.create.fromPlaceholder}
                options={sources.map((source) => ({
                  value: source.projectId,
                  // The available amount travels in the label, so the choice is
                  // made with the number in view.
                  label: `${source.name} · ${formatCurrency(source.availableAmount)}`,
                }))}
                value={fromProjectId}
                onSelect={(value) => {
                  setFromProjectId(value);
                  // Clearing the destination avoids leaving from === to behind.
                  if (value && value === toProjectId) setToProjectId(null);
                }}
                className="w-full"
              />

              {selectedSource ? (
                <p className="text-xs text-ink-500">
                  {es.requests.create.available.replace(
                    "{amount}",
                    formatCurrency(selectedSource.availableAmount)
                  )}{" "}
                  <span className="text-ink-400">
                    {es.requests.create.availableHint}
                  </span>
                </p>
              ) : null}
            </FormField>

            <FormField label={es.requests.create.toLabel} htmlFor="toProjectId">
              {availableDestinations.length === 0 ? (
                <p className="text-sm text-ink-500">
                  {es.requests.create.noDestinations}
                </p>
              ) : (
                <FilterDropdown
                  icon={<span aria-hidden="true" />}
                  ariaLabel={es.requests.create.toLabel}
                  placeholder={es.requests.create.toPlaceholder}
                  clearLabel={es.requests.create.toPlaceholder}
                  options={availableDestinations.map((destination) => ({
                    value: destination.projectId,
                    label: destination.name,
                  }))}
                  value={toProjectId}
                  onSelect={setToProjectId}
                  className="w-full"
                />
              )}
            </FormField>

            <FormField
              label={es.requests.create.amountLabel}
              htmlFor="amount"
              error={amountError ?? undefined}
            >
              <Input
                id="amount"
                name="amount"
                inputMode="decimal"
                inputSize="xl"
                className="rounded-[5px]"
                placeholder={es.requests.create.amountPlaceholder}
                value={amountText}
                disabled={isSubmitting}
                aria-invalid={!!amountError || undefined}
                aria-describedby={amountError ? "amount-error" : undefined}
                // Digits and a single decimal point only: no commas, no letters.
                onChange={(event) =>
                  setAmountText(
                    event.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1")
                  )
                }
              />
            </FormField>
          </>
        )}
      </FormDialog>
    </>
  );
}
