"use client";

import { useMemo, useState } from "react";
import { DollarSignIcon } from "lucide-react";
import { es } from "@/i18n";
import { formatCurrency } from "@/lib/format";
import {
  describeReturnOffer,
  estimateReturn,
  type ReturnOffer,
} from "@/lib/projects/return-offer";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  ReturnRangeChart,
  type ReturnRangePoint,
} from "@/components/charts/ReturnRangeChart";

/** The two offers a calculator can say something about. */
export type CalculableOffer = Extract<ReturnOffer, { kind: "annual" | "total" }>;

export type ReturnCalculatorProps = {
  /** The project's REAL offer — never a stand-in. */
  offer: CalculableOffer;
  className?: string;
};

/** Amount the field starts on, so the simulation shows something on arrival. */
const DEFAULT_AMOUNT = 10000;

const c = es.projectDetail.calculator;

/**
 * Return calculator, driven by the project's own offer.
 *
 * It used to run on hard-coded terms that had nothing to do with the project;
 * every figure now comes from `projects.return_offer` through estimateReturn,
 * which is where the arithmetic lives and is tested. This component only asks
 * for an amount (and a term, when the offer has several) and lays it out.
 *
 * Always a range, always simple interest, and never a figure the offer does
 * not support: a total with no stated term gets no monthly value and no curve,
 * because either would need a term we would have to invent.
 */
export function ReturnCalculator({ offer, className }: ReturnCalculatorProps) {
  const terms = offer.kind === "annual" ? offer.terms.map((term) => term.months) : [];

  const [amountText, setAmountText] = useState(String(DEFAULT_AMOUNT));
  const [termMonths, setTermMonths] = useState<number | undefined>(terms[0]);

  // Everything but digits goes: the field accepts "10,000" or "$10.000" and
  // still yields a number, instead of rejecting what the user typed.
  const amount = Number(amountText.replace(/\D/g, "")) || 0;

  const estimate = useMemo(
    () => estimateReturn(offer, amount, termMonths),
    [offer, amount, termMonths]
  );

  const points = useMemo<ReturnRangePoint[] | null>(() => {
    if (!estimate?.months) return null;
    const months = estimate.months;
    return Array.from({ length: months }, (_, index) => {
      const share = (index + 1) / months;
      return {
        month: index + 1,
        min: estimate.totalMin * share,
        max: estimate.totalMax * share,
      };
    });
  }, [estimate]);

  // A fixed rate yields one figure; "entre $X y $X" would read as a glitch.
  const range = (min: number, max: number) =>
    Math.round(min) === Math.round(max)
      ? formatCurrency(min)
      : c.range.replace("{min}", formatCurrency(min)).replace("{max}", formatCurrency(max));

  const monthsLabel = (months: number) => c.termMonths.replace("{n}", String(months));

  // A term is a CHOICE only when the offer has several; otherwise it is a fact
  // and renders as a static chip, not a control that does nothing when pressed.
  const staticTerm =
    offer.kind === "annual"
      ? terms.length === 1
        ? terms[0]
        : null
      : offer.months;

  return (
    <section
      className={cn(
        "flex flex-col gap-5 rounded-[10px] border border-neutral-200 bg-stone-50 p-6",
        className
      )}
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-xl font-medium text-stone-900">{c.title}</h3>
        {/* Where the numbers come from, stated: the investor can check the
            estimate against the offer they are reading about. */}
        <p className="text-sm text-zinc-600">
          {c.basedOn.replace("{offer}", describeReturnOffer(offer))}
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-600">{c.amountLabel}</span>
          <Input
            inputSize="xl"
            inputMode="numeric"
            value={amountText}
            onChange={(event) => setAmountText(event.target.value)}
            placeholder={c.amountPlaceholder}
            icon={<DollarSignIcon />}
            className="rounded-[5px]"
          />
        </label>

        {staticTerm ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-600">
              {offer.kind === "annual" ? c.termLabel : c.termFixed}
            </span>
            <span className="flex h-12 items-center rounded-[5px] bg-slate-950 px-4 text-sm font-medium text-stone-50">
              {monthsLabel(staticTerm)}
            </span>
          </div>
        ) : terms.length > 1 ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-600">{c.termLabel}</span>
            <div className="flex flex-wrap gap-2">
              {terms.map((months) => {
                const isActive = months === termMonths;
                return (
                  <button
                    key={months}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setTermMonths(months)}
                    className={cn(
                      "flex h-12 cursor-pointer items-center rounded-[5px] px-4 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-slate-950 text-stone-50"
                        : "bg-stone-50 text-stone-900 outline outline-1 -outline-offset-1 outline-neutral-200 hover:bg-stone-100"
                    )}
                  >
                    {monthsLabel(months)}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {estimate ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <p className="text-sm text-zinc-600">{c.totalLabel}</p>
              <p className="text-xl font-medium text-stone-900">
                {range(estimate.totalMin, estimate.totalMax)}
              </p>
            </div>
            {estimate.monthlyMin !== null && estimate.monthlyMax !== null ? (
              <div className="flex flex-col gap-1">
                <p className="text-sm text-zinc-600">{c.monthlyLabel}</p>
                <p className="text-xl font-medium text-stone-900">
                  {range(estimate.monthlyMin, estimate.monthlyMax)}
                </p>
              </div>
            ) : (
              <p className="self-end text-sm text-zinc-500">{c.noTermNote}</p>
            )}
          </div>

          {points ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-zinc-600">{c.chartTitle}</p>
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-slate-950" />
                    {c.chartMax}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="h-0.5 w-4 rounded-full bg-slate-950/50"
                    />
                    {c.chartMin}
                  </span>
                </div>
              </div>
              <ReturnRangeChart points={points} ariaLabel={c.chartTitle} />
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-zinc-500">{c.amountEmpty}</p>
      )}

      {/* Never collapsed, never behind a tooltip: it is what stops the numbers
          above from reading as a promise. */}
      <p className="text-xs text-neutral-400">{c.disclaimer}</p>
    </section>
  );
}
