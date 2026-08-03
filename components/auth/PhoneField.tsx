"use client";

import { useMemo, useState } from "react";
import { ChevronDownIcon, PhoneIcon, SearchIcon } from "lucide-react";
import { es } from "@/i18n";
import {
  COUNTRIES,
  searchCountries,
  type Country,
} from "@/lib/onboarding/countries";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type PhoneFieldProps = {
  id: string;
  /** Dial code including "+", e.g. "+57". */
  countryCode: string;
  onCountryCodeChange: (dial: string) => void;
  /** National number. Non-digits are stripped as the user types. */
  value: string;
  onValueChange: (value: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
  disabled?: boolean;
};

/**
 * Phone number with the country dial code built into the same control.
 *
 * The outer div carries the border, the height and the focus ring, so the pair
 * reads as ONE input matching every other field on the screen — the selector is
 * a segment inside it, not a second box beside it. `focus-within` is what moves
 * the ring from the inner elements to the shared frame.
 *
 * Digits are stripped on the way in rather than rejected: someone pasting
 * "300 123 4567" gets it cleaned up instead of an error.
 */
export function PhoneField({
  id,
  countryCode,
  onCountryCodeChange,
  value,
  onValueChange,
  onBlur,
  invalid,
  disabled,
}: PhoneFieldProps) {
  const [query, setQuery] = useState("");

  const selected: Country =
    COUNTRIES.find((country) => country.dial === countryCode) ?? COUNTRIES[0];

  const matches = useMemo(() => searchCountries(query), [query]);

  return (
    <div
      className={cn(
        "flex h-12 w-full items-stretch overflow-hidden rounded-[5px] border border-input bg-transparent transition-colors",
        "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        invalid && "border-destructive ring-3 ring-destructive/20",
        disabled && "pointer-events-none opacity-50"
      )}
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          type="button"
          aria-label={es.onboarding.country.selectLabel}
          disabled={disabled}
          className="flex cursor-pointer items-center gap-1.5 px-3 text-sm text-ink-900 outline-none hover:bg-muted/50"
        >
          <span aria-hidden="true" className="text-base leading-none">
            {selected.flag}
          </span>
          <span className="tabular-nums">{selected.dial}</span>
          <ChevronDownIcon className="size-4 text-ink-500" aria-hidden="true" />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          className="max-h-72 w-64 overflow-y-auto rounded-[5px] bg-stone-50 p-1.5 ring-1 ring-neutral-200"
        >
          {/* Search sits inside the popup so the trigger stays compact. */}
          <div className="relative mb-1">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={es.onboarding.country.searchPlaceholder}
              aria-label={es.onboarding.country.searchPlaceholder}
              className="h-9 w-full rounded-[5px] border border-neutral-200 bg-white pr-2 pl-8 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus-visible:border-ink-700"
            />
          </div>

          {matches.length === 0 ? (
            <p className="px-2 py-3 text-center text-sm text-ink-500">
              {es.onboarding.country.noResults}
            </p>
          ) : (
            matches.map((country) => (
              <button
                key={country.code}
                type="button"
                onClick={() => {
                  onCountryCodeChange(country.dial);
                  setQuery("");
                }}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-[5px] px-2 py-2 text-left text-sm text-ink-900 hover:bg-muted",
                  country.dial === selected.dial && "bg-muted"
                )}
              >
                <span aria-hidden="true">{country.flag}</span>
                <span className="min-w-0 flex-1 truncate">{country.name}</span>
                <span className="shrink-0 tabular-nums text-ink-500">
                  {country.dial}
                </span>
              </button>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <span aria-hidden="true" className="my-2 w-px shrink-0 bg-neutral-200" />

      <span
        aria-hidden="true"
        className="flex items-center pl-3 text-muted-foreground"
      >
        <PhoneIcon className="size-5" />
      </span>

      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={value}
        // Strip here, not on submit: what the field shows is what gets stored.
        onChange={(event) => onValueChange(event.target.value.replace(/\D/g, ""))}
        onBlur={onBlur}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        placeholder={es.onboarding.phonePlaceholder}
        className="min-w-0 flex-1 bg-transparent px-3 text-base text-ink-900 outline-none placeholder:text-ink-400 md:text-sm"
      />
    </div>
  );
}
