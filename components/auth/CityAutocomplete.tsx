"use client";

import { useEffect, useRef, useState } from "react";
import { MapPinIcon } from "lucide-react";
import { es } from "@/i18n";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { PlacePrediction } from "@/app/api/places/autocomplete/route";

export type CitySelection = {
  city: string;
  placeId: string;
  country: string;
};

export type CityAutocompleteProps = {
  id: string;
  /** Text currently in the field. */
  value: string;
  /** Fires on every keystroke; a typed value clears any previous selection. */
  onValueChange: (value: string) => void;
  /** Fires only when an option is picked from the list. */
  onSelect: (selection: CitySelection) => void;
  onBlur?: () => void;
  invalid?: boolean;
  disabled?: boolean;
};

/** Wait after the last keystroke before asking the server, in ms. */
const DEBOUNCE_MS = 300;

/** Shorter than this and the suggestions are noise. Matches the route handler. */
const MIN_QUERY_LENGTH = 2;

/**
 * City field: a combobox over our own Places proxy.
 *
 * NOT Google's widget. That one injects its own stylesheet and would fight the
 * design system; this is the project's own Input with a hand-styled list under
 * it, so the field is visually identical to every other one on the screen.
 *
 * A value only counts once it is PICKED: typing clears the previous selection,
 * and the form checks for the placeId, so free text can never pass as a city.
 *
 * Attribution is not optional — the Places API (New) requires "Powered by
 * Google" wherever predictions are shown without a map, so it is pinned to the
 * bottom of the list.
 */
export function CityAutocomplete({
  id,
  value,
  onValueChange,
  onSelect,
  onBlur,
  invalid,
  disabled,
}: CityAutocompleteProps) {
  /**
   * The last finished lookup, tagged with the query that produced it.
   *
   * Keeping the query alongside the results is what makes "loading" a DERIVED
   * value: whenever the field no longer matches what was fetched, the request
   * is either still debouncing or still in flight, and the list is stale. That
   * removes any need to reset state synchronously inside the effect — which
   * would cascade renders — and it also stops the previous city's suggestions
   * from flashing under the new keystrokes.
   */
  const [result, setResult] = useState<{
    key: string;
    predictions: PlacePrediction[];
    failed: boolean;
  }>({ key: "", predictions: [], failed: false });

  const [isOpen, setIsOpen] = useState(false);
  /** Bumped to re-run the effect when the user asks to retry. */
  const [retryToken, setRetryToken] = useState(0);
  /** Set while a click on an option is in flight, to keep blur from closing it. */
  const isPickingRef = useRef(false);

  const query = value.trim();
  // The retry token is part of the key, so pressing "reintentar" makes the
  // current result stale and the list falls back to its loading state.
  const requestKey = `${retryToken}:${query}`;

  useEffect(() => {
    if (query.length < MIN_QUERY_LENGTH) return;

    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/places/autocomplete?q=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error(String(response.status));
        const payload = (await response.json()) as {
          predictions: PlacePrediction[];
        };
        setResult({
          key: requestKey,
          predictions: payload.predictions ?? [],
          failed: false,
        });
      } catch (error) {
        // An aborted request is the next keystroke, not a failure.
        if (controller.signal.aborted) return;
        void error;
        setResult({ key: requestKey, predictions: [], failed: true });
      }
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, requestKey]);

  const isStale = result.key !== requestKey;
  const status: "loading" | "error" | "done" = isStale
    ? "loading"
    : result.failed
      ? "error"
      : "done";
  const predictions = isStale ? [] : result.predictions;

  const showList = isOpen && query.length >= MIN_QUERY_LENGTH;

  return (
    <div className="relative">
      <Input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
        aria-controls={`${id}-listbox`}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        autoComplete="off"
        inputSize="xl"
        icon={<MapPinIcon />}
        className="rounded-[5px]"
        placeholder={es.onboarding.cityPlaceholder}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onValueChange(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          // Blur fires before click; closing immediately would cancel the pick.
          window.setTimeout(() => {
            if (!isPickingRef.current) setIsOpen(false);
            onBlur?.();
          }, 120);
        }}
      />

      {showList ? (
        <div
          id={`${id}-listbox`}
          role="listbox"
          className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-[5px] border border-neutral-200 bg-stone-50 shadow-md"
        >
          {status === "loading" ? (
            <p className="px-3 py-3 text-sm text-ink-500">
              {es.onboarding.city.searching}
            </p>
          ) : status === "error" ? (
            <div className="flex items-center justify-between gap-2 px-3 py-3">
              <p className="text-sm text-ink-500">{es.onboarding.city.error}</p>
              <button
                type="button"
                onMouseDown={() => {
                  isPickingRef.current = true;
                  setRetryToken((token) => token + 1);
                  window.setTimeout(() => {
                    isPickingRef.current = false;
                  }, 200);
                }}
                className="shrink-0 cursor-pointer text-sm font-medium text-ink-900 underline underline-offset-4"
              >
                {es.onboarding.city.retry}
              </button>
            </div>
          ) : predictions.length === 0 ? (
            <p className="px-3 py-3 text-sm text-ink-500">
              {es.onboarding.city.noResults}
            </p>
          ) : (
            <ul className="max-h-60 overflow-y-auto py-1">
              {predictions.map((prediction) => (
                <li key={prediction.placeId} role="option" aria-selected={false}>
                  <button
                    type="button"
                    // onMouseDown, not onClick: it runs before the input's blur.
                    onMouseDown={() => {
                      isPickingRef.current = true;
                    }}
                    onClick={() => {
                      onSelect({
                        city: prediction.city,
                        placeId: prediction.placeId,
                        country: prediction.country,
                      });
                      setIsOpen(false);
                      isPickingRef.current = false;
                    }}
                    className={cn(
                      "w-full cursor-pointer px-3 py-2 text-left text-sm text-ink-900 hover:bg-muted"
                    )}
                  >
                    {prediction.description}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Required by the Places API (New) terms when predictions are shown
              without a Google map on screen. Do not remove. */}
          <p className="border-t border-neutral-200 px-3 py-1.5 text-right text-[11px] text-ink-400">
            {es.onboarding.city.attribution}
          </p>
        </div>
      ) : null}
    </div>
  );
}
