/**
 * Types for the "Me interesa este proyecto" form.
 *
 * Note what the payload does NOT carry: `user_id`, `status` and `phone`. The
 * first is derived from auth.uid() on the server and the second is forced to
 * 'nuevo'. The phone is taken from the profile, where the onboarding already
 * collected it — asking again for something we hold is friction with no gain.
 */

/**
 * Values allowed by investment_interests.investment_type_pref (CHECK in
 * 20260730000940_tablas_movimiento.sql). Spanish because the database stores
 * them that way; the visible labels live in i18n.
 */
export const INVESTMENT_TYPE_PREFS = [
  "equity",
  "deuda",
  "préstamo",
  "socio",
  "no estoy seguro",
] as const;

export type InvestmentTypePref = (typeof INVESTMENT_TYPE_PREFS)[number];

export function isInvestmentTypePref(
  value: unknown
): value is InvestmentTypePref {
  return (
    typeof value === "string" &&
    (INVESTMENT_TYPE_PREFS as readonly string[]).includes(value)
  );
}

/** What the form sends. */
export type CreateInterestInput = {
  projectId: string;
  /** Optional: someone may be interested without a figure in mind yet. */
  amount?: number | null;
  investmentTypePref: InvestmentTypePref;
  comments?: string | null;
};

/** Result of the Server Action, in the shape the card renders. */
export type CreateInterestResult = { ok: true } | { ok: false; error: string };
