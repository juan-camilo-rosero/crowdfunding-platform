"use client";

import { useMemo, useState } from "react";
import { DollarSignIcon } from "lucide-react";
import { es } from "@/i18n";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  ReturnRangeChart,
  type ReturnRangePoint,
} from "@/components/charts/ReturnRangeChart";

/**
 * One offer of term and annual rate range.
 *
 * `annualMin`/`annualMax` are RATES, not percentages: 0.12 means 12% a year.
 * A range rather than a single rate on purpose — the output of this calculator
 * must never read as a figure the investor will receive.
 */
export type ReturnTerm = {
  months: number;
  annualMin: number;
  annualMax: number;
};

export type ReturnCalculatorProps = {
  /** Terms offered. The first one is selected initially. */
  terms: ReturnTerm[];
  className?: string;
};

/** Amount the field starts on, so the simulation shows something on arrival. */
const DEFAULT_AMOUNT = 10000;

export function ReturnCalculator({ terms, className }: ReturnCalculatorProps) {
  const [amountText, setAmountText] = useState(String(DEFAULT_AMOUNT));
  const [termMonths, setTermMonths] = useState(terms[0]?.months ?? 12);

  const term = terms.find((item) => item.months === termMonths) ?? terms[0];

  // Everything but digits goes: the field accepts "10,000" or "$10.000" and
  // still yields a number, instead of rejecting what the user typed.
  const amount = Number(amountText.replace(/\D/g, "")) || 0;

  const estimate = useMemo(() => {
    if (!term || amount <= 0) return null;

    const years = term.months / 12;
    const totalMin = amount * term.annualMin * years;
    const totalMax = amount * term.annualMax * years;

    const points: ReturnRangePoint[] = Array.from(
      { length: term.months },
      (_, index) => {
        const share = (index + 1) / term.months;
        return {
          month: index + 1,
          min: totalMin * share,
          max: totalMax * share,
        };
      }
    );

    return {
      totalMin,
      totalMax,
      monthlyMin: totalMin / term.months,
      monthlyMax: totalMax / term.months,
      points,
    };
  }, [amount, term]);

  const range = (min: number, max: number) =>
    es.projectDetail.calculator.range
      .replace("{min}", formatCurrency(min))
      .replace("{max}", formatCurrency(max));

  return (
    <section
      className={cn(
        "flex flex-col gap-5 rounded-[10px] border border-neutral-200 bg-stone-50 p-6",
        className
      )}
    >
      <h3 className="text-xl font-medium text-stone-900">
        {es.projectDetail.calculator.title}
      </h3>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-600">
            {es.projectDetail.calculator.amountLabel}
          </span>
          <Input
            inputSize="xl"
            inputMode="numeric"
            value={amountText}
            onChange={(event) => setAmountText(event.target.value)}
            placeholder={es.projectDetail.calculator.amountPlaceholder}
            icon={<DollarSignIcon />}
            className="rounded-[5px]"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-600">
            {es.projectDetail.calculator.termLabel}
          </span>
          {/* A single term is not a choice, so it renders as a static chip
              rather than a control that does nothing when pressed. */}
          <div className="flex flex-wrap gap-2">
            {terms.map((item) => {
              const label = es.projectDetail.calculator.termMonths.replace(
                "{n}",
                String(item.months)
              );
              if (terms.length === 1) {
                return (
                  <span
                    key={item.months}
                    className="flex h-12 items-center rounded-[5px] bg-slate-950 px-4 text-sm font-medium text-stone-50"
                  >
                    {label}
                  </span>
                );
              }
              const isActive = item.months === termMonths;
              return (
                <button
                  key={item.months}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setTermMonths(item.months)}
                  className={cn(
                    "flex h-12 cursor-pointer items-center rounded-[5px] px-4 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-slate-950 text-stone-50"
                      : "bg-stone-50 text-stone-900 outline outline-1 -outline-offset-1 outline-neutral-200 hover:bg-stone-100"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {estimate ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <p className="text-sm text-zinc-600">
                {es.projectDetail.calculator.totalLabel}
              </p>
              <p className="text-xl font-medium text-stone-900">
                {range(estimate.totalMin, estimate.totalMax)}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm text-zinc-600">
                {es.projectDetail.calculator.monthlyLabel}
              </p>
              <p className="text-xl font-medium text-stone-900">
                {range(estimate.monthlyMin, estimate.monthlyMax)}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-zinc-600">
                {es.projectDetail.calculator.chartTitle}
              </p>
              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="h-0.5 w-4 rounded-full bg-slate-950"
                  />
                  {es.projectDetail.calculator.chartMax}
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="h-0.5 w-4 rounded-full bg-slate-950/50"
                  />
                  {es.projectDetail.calculator.chartMin}
                </span>
              </div>
            </div>
            <ReturnRangeChart
              points={estimate.points}
              ariaLabel={es.projectDetail.calculator.chartTitle}
            />
          </div>
        </>
      ) : (
        <p className="text-sm text-zinc-500">
          {es.projectDetail.calculator.amountEmpty}
        </p>
      )}

      {/* Never collapsed, never behind a tooltip: it is what stops the numbers
          above from reading as a promise. */}
      <p className="text-xs text-neutral-400">
        {es.projectDetail.calculator.disclaimer}
      </p>
    </section>
  );
}
