import { es } from "@/i18n";

/**
 * The return a project OFFERS publicly, structured.
 *
 * It used to be free text ("Hasta 15% anual") while the project page ran a
 * calculator on made-up terms — so the one figure an investor could play with
 * had no relation to what the project actually offered. The offer is now data,
 * and the label, the catalogue and the calculator all come from it.
 *
 * Three shapes, because these are the three ways the group actually offers
 * return:
 *   · annual         a yearly rate per term — "10–15% a 12 meses";
 *   · total          a total return at exit — "20% al cierre, ~18 meses";
 *   · participation  a share of the project's profit — "8% de utilidades".
 *
 * Rates are PERCENTAGES (12 means 12%), as people type them. Every rate is a
 * range (min–max); a fixed rate is simply min = max. A range and never a point,
 * so nothing here reads as a figure the investor is guaranteed.
 *
 * NOT the per-investor agreed return (capital_contributions.agreed_return),
 * which stays free text by rule: it is a contract term, not a catalogue offer.
 */

export const RETURN_OFFER_KINDS = ["annual", "total", "participation"] as const;
export type ReturnOfferKind = (typeof RETURN_OFFER_KINDS)[number];

export type AnnualTerm = { months: number; min: number; max: number };

export type ReturnOffer =
  | { kind: "annual"; terms: AnnualTerm[] }
  | { kind: "total"; min: number; max: number; months: number | null }
  | { kind: "participation"; percent: number };

export const RETURN_OFFER_LIMITS = {
  /** A yearly rate above 100% is a typo, not an offer. */
  maxAnnual: 100,
  /** A total at exit can pass 100% on a long project; three times is a typo. */
  maxTotal: 300,
  maxParticipation: 100,
  /** Ten years: longer than any project the group runs. */
  maxMonths: 120,
  /** More terms than this stops being a choice and becomes a table. */
  maxTerms: 6,
} as const;

type Check<T> = { ok: true; value: T } | { ok: false; error: string };

const t = es.returnOffer;

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template
  );
}

const round2 = (value: number) => Math.round(value * 100) / 100;

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function checkRate(value: unknown, max: number): string | null {
  if (!isNumber(value)) return t.errors.rateNumber;
  if (value <= 0 || value > max) return fill(t.errors.rateRange, { max });
  return null;
}

function checkMonths(value: unknown): string | null {
  if (!isNumber(value) || !Number.isInteger(value)) {
    return fill(t.errors.termMonths, { max: RETURN_OFFER_LIMITS.maxMonths });
  }
  if (value < 1 || value > RETURN_OFFER_LIMITS.maxMonths) {
    return fill(t.errors.termMonths, { max: RETURN_OFFER_LIMITS.maxMonths });
  }
  return null;
}

function checkRange(min: unknown, max: unknown, limit: number): string | null {
  const minError = checkRate(min, limit);
  if (minError) return minError;
  const maxError = checkRate(max, limit);
  if (maxError) return maxError;
  if ((max as number) < (min as number)) return t.errors.maxBelowMin;
  return null;
}

/**
 * The one gate every offer passes — from the database, from the editor, from
 * a request. Unknown fields are dropped, numbers rounded to two decimals and
 * terms sorted, so the result is CANONICAL: two equal offers are equal objects
 * and serialize to the same string.
 */
function checkOffer(candidate: unknown): Check<ReturnOffer> {
  if (!candidate || typeof candidate !== "object") {
    return { ok: false, error: t.errors.invalid };
  }
  const input = candidate as Record<string, unknown>;

  switch (input.kind) {
    case "annual": {
      if (!Array.isArray(input.terms) || input.terms.length === 0) {
        return { ok: false, error: t.errors.noTerms };
      }
      if (input.terms.length > RETURN_OFFER_LIMITS.maxTerms) {
        return {
          ok: false,
          error: fill(t.errors.tooManyTerms, { n: RETURN_OFFER_LIMITS.maxTerms }),
        };
      }

      const terms: AnnualTerm[] = [];
      for (const raw of input.terms) {
        const term = (raw ?? {}) as Record<string, unknown>;
        const error =
          checkMonths(term.months) ??
          checkRange(term.min, term.max, RETURN_OFFER_LIMITS.maxAnnual);
        if (error) return { ok: false, error };

        const months = term.months as number;
        if (terms.some((existing) => existing.months === months)) {
          return { ok: false, error: fill(t.errors.duplicateTerm, { months }) };
        }
        terms.push({
          months,
          min: round2(term.min as number),
          max: round2(term.max as number),
        });
      }

      terms.sort((a, b) => a.months - b.months);
      return { ok: true, value: { kind: "annual", terms } };
    }

    case "total": {
      const error = checkRange(input.min, input.max, RETURN_OFFER_LIMITS.maxTotal);
      if (error) return { ok: false, error };

      const months = input.months ?? null;
      if (months !== null) {
        const monthsError = checkMonths(months);
        if (monthsError) return { ok: false, error: monthsError };
      }

      return {
        ok: true,
        value: {
          kind: "total",
          min: round2(input.min as number),
          max: round2(input.max as number),
          months: months as number | null,
        },
      };
    }

    case "participation": {
      const error = checkRate(input.percent, RETURN_OFFER_LIMITS.maxParticipation);
      if (error) return { ok: false, error };
      return {
        ok: true,
        value: { kind: "participation", percent: round2(input.percent as number) },
      };
    }

    default:
      return { ok: false, error: t.errors.kind };
  }
}

/**
 * Reads an offer for DISPLAY: the jsonb object from the database, or the JSON
 * string the grid holds for an edit. Anything unreadable is null — a broken
 * value must hide the calculator, never crash the page or show a wrong figure.
 */
export function parseReturnOffer(raw: unknown): ReturnOffer | null {
  let candidate = raw;
  if (typeof raw === "string") {
    if (!raw.trim()) return null;
    try {
      candidate = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const result = checkOffer(candidate);
  return result.ok ? result.value : null;
}

/** Canonical JSON (fixed key order, sorted terms); "" for no offer. */
export function serializeReturnOffer(offer: ReturnOffer | null): string {
  if (!offer) return "";
  const result = checkOffer(offer);
  if (!result.ok) return "";
  const value = result.value;

  switch (value.kind) {
    case "annual":
      return JSON.stringify({
        kind: "annual",
        terms: value.terms.map(({ months, min, max }) => ({ months, min, max })),
      });
    case "total":
      return JSON.stringify({
        kind: "total",
        min: value.min,
        max: value.max,
        months: value.months,
      });
    case "participation":
      return JSON.stringify({ kind: "participation", percent: value.percent });
  }
}

/**
 * The SERVER's gate for a value coming from the admin grid or form. Returns the
 * canonical string to store, or a message in Spanish saying what is wrong.
 */
export function validateReturnOffer(raw: string): Check<string> {
  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch {
    return { ok: false, error: t.errors.invalid };
  }
  const result = checkOffer(candidate);
  if (!result.ok) return result;
  return { ok: true, value: serializeReturnOffer(result.value) };
}

// ── Labels ─────────────────────────────────────────────────────────────────

const numberFormat = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

function rate(min: number, max: number): string {
  return min === max
    ? `${numberFormat.format(min)}%`
    : `${numberFormat.format(min)}%–${numberFormat.format(max)}%`;
}

function months(count: number): string {
  return count === 1 ? t.monthOne : fill(t.months, { n: count });
}

/** The line an investor reads: "8%–15% anual · 6 a 12 meses". "" for none. */
export function describeReturnOffer(offer: ReturnOffer | null): string {
  if (!offer) return "";

  switch (offer.kind) {
    case "annual": {
      const low = Math.min(...offer.terms.map((term) => term.min));
      const high = Math.max(...offer.terms.map((term) => term.max));
      const first = offer.terms[0].months;
      const last = offer.terms[offer.terms.length - 1].months;
      const span =
        first === last ? months(first) : fill(t.monthSpan, { from: first, to: last });
      return `${fill(t.annual, { rate: rate(low, high) })} · ${span}`;
    }
    case "total": {
      const label = fill(t.total, { rate: rate(offer.min, offer.max) });
      return offer.months ? `${label} · ${months(offer.months)}` : label;
    }
    case "participation":
      return fill(t.participation, { rate: rate(offer.percent, offer.percent) });
  }
}

/**
 * The catalogue's label: the structured offer when there is one, otherwise the
 * legacy free text the project was published with. Empty when neither.
 */
export function returnOfferLabel(raw: unknown, legacy?: string | null): string {
  const described = describeReturnOffer(parseReturnOffer(raw));
  return described || legacy?.trim() || "";
}

// ── Editor draft ───────────────────────────────────────────────────────────

/**
 * What the editor holds while the admin types: strings, so "12," halfway to
 * "12,5" is a valid state of the form rather than an error. All three shapes
 * are kept at once, so switching kind and back does not lose what was typed.
 */
export type ReturnOfferDraft = {
  kind: ReturnOfferKind | "none";
  terms: { months: string; min: string; max: string }[];
  totalMin: string;
  totalMax: string;
  totalMonths: string;
  participation: string;
};

const EMPTY_TERM = { months: "", min: "", max: "" };

const toText = (value: number | null | undefined) =>
  value === null || value === undefined ? "" : numberFormat.format(value).replace(/\./g, "");

export function offerToDraft(offer: ReturnOffer | null): ReturnOfferDraft {
  const draft: ReturnOfferDraft = {
    kind: offer?.kind ?? "none",
    terms: [{ ...EMPTY_TERM }],
    totalMin: "",
    totalMax: "",
    totalMonths: "",
    participation: "",
  };
  if (!offer) return draft;

  switch (offer.kind) {
    case "annual":
      draft.terms = offer.terms.map((term) => ({
        months: String(term.months),
        min: toText(term.min),
        // A fixed rate shows only its minimum; the editor reads the empty
        // maximum back as "same as the minimum".
        max: term.max === term.min ? "" : toText(term.max),
      }));
      break;
    case "total":
      draft.totalMin = toText(offer.min);
      draft.totalMax = offer.max === offer.min ? "" : toText(offer.max);
      draft.totalMonths = offer.months ? String(offer.months) : "";
      break;
    case "participation":
      draft.participation = toText(offer.percent);
      break;
  }
  return draft;
}

/** "12", "12,5", "12.5", "12 %" → number; "" → null; anything else → NaN. */
function parseDecimal(text: string): number | null {
  const cleaned = text.replace(/%/g, "").replace(/\s/g, "").replace(",", ".");
  if (!cleaned) return null;
  return /^\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : Number.NaN;
}

function parseWhole(text: string): number | null {
  const cleaned = text.trim();
  if (!cleaned) return null;
  return /^\d+$/.test(cleaned) ? Number(cleaned) : Number.NaN;
}

/**
 * Turns what the admin typed into an offer, or into the ONE message that says
 * what to fix — worded around what they see ("el plazo de 18 meses"), not
 * around field names.
 */
export function draftToOffer(
  draft: ReturnOfferDraft
): { ok: true; offer: ReturnOffer | null } | { ok: false; error: string } {
  const toResult = (candidate: unknown) => {
    const result = checkOffer(candidate);
    return result.ok
      ? ({ ok: true, offer: result.value } as const)
      : ({ ok: false, error: result.error } as const);
  };

  switch (draft.kind) {
    case "none":
      return { ok: true, offer: null };

    case "annual": {
      const rows = draft.terms.filter(
        (row) => row.months.trim() || row.min.trim() || row.max.trim()
      );
      if (rows.length === 0) return { ok: false, error: t.errors.noTerms };

      const terms = [];
      for (const [index, row] of rows.entries()) {
        const monthsValue = parseWhole(row.months);
        if (monthsValue === null) {
          return { ok: false, error: fill(t.errors.termMissingMonths, { n: index + 1 }) };
        }
        const min = parseDecimal(row.min);
        if (min === null) {
          return {
            ok: false,
            error: fill(t.errors.termMissingRate, {
              months: Number.isNaN(monthsValue) ? row.months : monthsValue,
            }),
          };
        }
        const max = parseDecimal(row.max);
        terms.push({ months: monthsValue, min, max: max ?? min });
      }
      return toResult({ kind: "annual", terms });
    }

    case "total": {
      const min = parseDecimal(draft.totalMin);
      if (min === null) return { ok: false, error: t.errors.missingTotal };
      const max = parseDecimal(draft.totalMax);
      return toResult({
        kind: "total",
        min,
        max: max ?? min,
        months: parseWhole(draft.totalMonths),
      });
    }

    case "participation": {
      const percent = parseDecimal(draft.participation);
      if (percent === null) return { ok: false, error: t.errors.missingParticipation };
      return toResult({ kind: "participation", percent });
    }
  }
}

// ── Calculator ─────────────────────────────────────────────────────────────

export type ReturnEstimate = {
  totalMin: number;
  totalMax: number;
  /** null when the offer has no term: a monthly figure would be invented. */
  monthlyMin: number | null;
  monthlyMax: number | null;
  months: number | null;
};

/**
 * What an amount could yield under the offer. Simple, never compounded, and
 * always a range.
 *
 * A participation has NO estimate: it is a share of a profit nobody knows yet,
 * and computing one would mean inventing that profit.
 */
export function estimateReturn(
  offer: ReturnOffer,
  amount: number,
  termMonths?: number
): ReturnEstimate | null {
  if (!(amount > 0)) return null;

  switch (offer.kind) {
    case "annual": {
      const term =
        offer.terms.find((item) => item.months === termMonths) ?? offer.terms[0];
      // Multiply before dividing: fewer rounding steps, exact on round figures.
      const totalMin = (((amount * term.min) / 100) * term.months) / 12;
      const totalMax = (((amount * term.max) / 100) * term.months) / 12;
      return {
        totalMin,
        totalMax,
        monthlyMin: totalMin / term.months,
        monthlyMax: totalMax / term.months,
        months: term.months,
      };
    }
    case "total": {
      const totalMin = (amount * offer.min) / 100;
      const totalMax = (amount * offer.max) / 100;
      return {
        totalMin,
        totalMax,
        monthlyMin: offer.months ? totalMin / offer.months : null,
        monthlyMax: offer.months ? totalMax / offer.months : null,
        months: offer.months,
      };
    }
    case "participation":
      return null;
  }
}
