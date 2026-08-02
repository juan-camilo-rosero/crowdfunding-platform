import { es } from "@/i18n";

/**
 * Display helpers for projects. Kept out of the components so the catalogue,
 * the home screen and the detail page all read a project the same way.
 */

/**
 * Screen title for a project, composed from its type and city:
 *   "Casa en Rotonda, Florida"
 *
 * Every project of the group is in Florida, so the state is appended as fixed
 * context. `city = "Otra"` is the schema's catch-all and would read as
 * "Casa en Otra, Florida", so in that case the city is dropped and only the
 * state is kept. A project with no type falls back to a neutral noun.
 */
export function projectTitle(
  type: string | null | undefined,
  city: string | null | undefined
): string {
  const typeLabel = type ? (es.projects.type[type] ?? type) : es.projects.untitled;
  const hasNamedCity = !!city && city !== "Otra";

  return hasNamedCity
    ? `${typeLabel} en ${city}, ${es.projects.state}`
    : `${typeLabel} en ${es.projects.state}`;
}

/** Human label for projects.status; falls back to the stored value. */
export function projectStatusLabel(status: string | null | undefined): string {
  if (!status) return "";
  return es.projects.status[status] ?? status;
}

export type AgreedReturn = {
  /** Text to show, already resolved. */
  value: string;
  /** Caption under it, matching the shape of the value. */
  label: string;
  /** True when there is nothing to show (renders as a dash). */
  isEmpty: boolean;
};

/**
 * Resolves the agreed return for ONE position out of its contributions.
 *
 * `capital_contributions.agreed_return` is free text ("15% anual",
 * "Participación 8%") and a position can hold several contributions, so:
 *   · all of them agreeing  → that value, shown verbatim, never recalculated;
 *   · they disagree         → "Varios", because showing one of them would
 *                             misrepresent the rest of the capital;
 *   · none registered       → a dash.
 *
 * The caption follows the value: a return that mentions a period reads as
 * annual, anything else (a participation, for instance) gets the neutral label.
 */
export function resolveAgreedReturn(
  agreedReturns: (string | null | undefined)[]
): AgreedReturn {
  const values = [...new Set(
    agreedReturns
      .map((value) => value?.trim())
      .filter((value): value is string => !!value)
  )];

  if (values.length === 0) {
    return {
      value: es.investmentCard.noReturn,
      label: es.investmentCard.expectedReturn,
      isEmpty: true,
    };
  }

  if (values.length > 1) {
    return {
      value: es.investmentCard.mixedReturn,
      label: es.investmentCard.expectedReturn,
      isEmpty: false,
    };
  }

  const value = values[0];
  return {
    value,
    label: /anual/i.test(value)
      ? es.investmentCard.expectedAnnualReturn
      : es.investmentCard.expectedReturn,
    isEmpty: false,
  };
}

/**
 * Type size for the return figure on a project card.
 *
 * Fixed, NOT stepped by string length: every card in the grid must show this
 * figure at the same size, so "15% anual", "Varios" and "Participación 8%" read
 * as the same piece of information. The size is the one the longest of those
 * fits at without overflowing the card.
 */
export const RETURN_TEXT_SIZE = "text-lg";
