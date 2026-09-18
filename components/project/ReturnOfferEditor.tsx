"use client";

import { PlusIcon, TrashIcon } from "lucide-react";
import { es } from "@/i18n";
import {
  RETURN_OFFER_KINDS,
  RETURN_OFFER_LIMITS,
  describeReturnOffer,
  draftToOffer,
  type ReturnOfferDraft,
  type ReturnOfferKind,
} from "@/lib/projects/return-offer";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const t = es.returnOffer;

export type ReturnOfferEditorProps = {
  draft: ReturnOfferDraft;
  onDraftChange: (draft: ReturnOfferDraft) => void;
  className?: string;
};

const KINDS: (ReturnOfferKind | "none")[] = ["none", ...RETURN_OFFER_KINDS];

/**
 * Editor for a project's return offer.
 *
 * Shaped around how the offer is TALKED about, not around the JSON: first
 * "how is the return offered?", then only the few fields that kind needs, and
 * a live preview of the exact line the catalogue will print. The preview is
 * also where a mistake shows — in words, next to the thing it affects — so
 * nothing reaches the save button in a state that would be refused.
 *
 * Controlled and stateless: the draft lives with the caller (the grid's dialog,
 * the record form), which also decides when to save. Fields are text, not
 * number inputs, so "12,5" — how a Colombian admin writes it — is accepted.
 */
export function ReturnOfferEditor({
  draft,
  onDraftChange,
  className,
}: ReturnOfferEditorProps) {
  const result = draftToOffer(draft);
  const set = (patch: Partial<ReturnOfferDraft>) =>
    onDraftChange({ ...draft, ...patch });

  function setTerm(index: number, key: "months" | "min" | "max", value: string) {
    set({
      terms: draft.terms.map((term, i) => (i === index ? { ...term, [key]: value } : term)),
    });
  }

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink-900">{t.kindLabel}</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t.kindLabel}>
          {KINDS.map((kind) => {
            const isActive = draft.kind === kind;
            return (
              <Button
                key={kind}
                type="button"
                size="lg"
                variant={isActive ? "brand" : "outline"}
                aria-pressed={isActive}
                onClick={() => set({ kind })}
              >
                {t.kinds[kind]}
              </Button>
            );
          })}
        </div>
        <p className="text-sm text-ink-500">{t.kindHints[draft.kind]}</p>
      </div>

      {draft.kind === "annual" ? (
        <div className="flex flex-col gap-2">
          {/* Column labels once, above the rows; each input still carries its
              own accessible name with its row number. */}
          <div
            aria-hidden="true"
            className="grid grid-cols-[1fr_1fr_1fr_2.25rem] gap-2 text-sm font-medium text-ink-700"
          >
            <span>{t.termMonths}</span>
            <span>{t.rateMin}</span>
            <span>
              {t.rateMax} <span className="font-normal text-ink-400">({t.optional})</span>
            </span>
            <span />
          </div>

          {draft.terms.map((term, index) => {
            const row = index + 1;
            return (
              <div
                key={index}
                className="grid grid-cols-[1fr_1fr_1fr_2.25rem] items-center gap-2"
              >
                <Input
                  inputSize="xl"
                  inputMode="numeric"
                  aria-label={`${t.termMonths}, fila ${row}`}
                  value={term.months}
                  onChange={(event) => setTerm(index, "months", event.target.value)}
                />
                <Input
                  inputSize="xl"
                  inputMode="decimal"
                  aria-label={`${t.rateMin}, fila ${row}`}
                  value={term.min}
                  onChange={(event) => setTerm(index, "min", event.target.value)}
                />
                <Input
                  inputSize="xl"
                  inputMode="decimal"
                  aria-label={`${t.rateMax}, fila ${row}`}
                  value={term.max}
                  onChange={(event) => setTerm(index, "max", event.target.value)}
                />
                {/* The last row stays: there is always one to fill in. */}
                {draft.terms.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t.removeTerm.replace("{n}", String(row))}
                    onClick={() =>
                      set({ terms: draft.terms.filter((_, i) => i !== index) })
                    }
                  >
                    <TrashIcon aria-hidden="true" />
                  </Button>
                ) : (
                  <span />
                )}
              </div>
            );
          })}

          <Button
            type="button"
            variant="ghost"
            className="w-fit"
            disabled={draft.terms.length >= RETURN_OFFER_LIMITS.maxTerms}
            onClick={() =>
              set({ terms: [...draft.terms, { months: "", min: "", max: "" }] })
            }
          >
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            {t.addTerm}
          </Button>
        </div>
      ) : null}

      {draft.kind === "total" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <LabelledInput
            label={t.totalMin}
            value={draft.totalMin}
            inputMode="decimal"
            onChange={(totalMin) => set({ totalMin })}
          />
          <LabelledInput
            label={t.totalMax}
            optional
            value={draft.totalMax}
            inputMode="decimal"
            onChange={(totalMax) => set({ totalMax })}
          />
          <LabelledInput
            label={t.totalMonths}
            optional
            value={draft.totalMonths}
            inputMode="numeric"
            onChange={(totalMonths) => set({ totalMonths })}
          />
        </div>
      ) : null}

      {draft.kind === "participation" ? (
        <div className="max-w-xs">
          <LabelledInput
            label={t.participationLabel}
            value={draft.participation}
            inputMode="decimal"
            onChange={(participation) => set({ participation })}
          />
        </div>
      ) : null}

      {/* The line the catalogue will print — or, while something does not add
          up, what to fix. aria-live so the change is announced as it happens. */}
      <div
        data-testid="return-offer-preview"
        aria-live="polite"
        className="flex flex-col gap-1 rounded-[10px] border border-line bg-surface px-4 py-3"
      >
        <span className="text-xs font-medium tracking-[0.06em] text-ink-500 uppercase">
          {t.preview}
        </span>
        {result.ok ? (
          <span
            className={cn(
              "text-base font-medium",
              result.offer ? "text-ink-900" : "text-ink-400"
            )}
          >
            {describeReturnOffer(result.offer) || t.previewEmpty}
          </span>
        ) : (
          <span className="text-sm text-destructive">{result.error}</span>
        )}
      </div>
    </div>
  );
}

function LabelledInput({
  label,
  optional = false,
  value,
  inputMode,
  onChange,
}: {
  label: string;
  optional?: boolean;
  value: string;
  inputMode: "decimal" | "numeric";
  onChange: (value: string) => void;
}) {
  const name = optional ? `${label} (${t.optional})` : label;
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink-700">
        {label}
        {optional ? (
          <span className="font-normal text-ink-400"> ({t.optional})</span>
        ) : null}
      </span>
      <Input
        inputSize="xl"
        inputMode={inputMode}
        aria-label={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
