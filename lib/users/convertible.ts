/**
 * The linking funnel: users who signed up on their own (Camino B in
 * user-management.md) and are waiting for an admin to turn them into
 * investors.
 *
 * Being an investor is DERIVED from a row in `investors` pointing at the
 * user_id — never from users.role. So "converting" someone means creating or
 * connecting that row, and nothing else: role stays 'visitante', which is
 * correct, because role only measures the administrative level.
 */

export type ConvertibleUser = {
  id: string;
  fullName: string | null;
  email: string;
  phone: string | null;
  /** When they signed up. */
  createdAt: string;
  /**
   * True when an UNLINKED row already exists in `investors` with this email —
   * an admin invited them first (Camino A) and the two halves have not met yet.
   * Converting will CONNECT that row instead of creating a second one.
   */
  hasMatchingProspect: boolean;
};

/** Where a conversion ended up, so the UI can say which of the two happened. */
export type ConversionOutcome = "connected" | "created";

export type ConvertResult =
  | { ok: true; outcome: ConversionOutcome }
  | { ok: false; error: string };

/**
 * Default pipeline stage for a freshly created record.
 *
 * 'contacto' rather than null: the person exists and has an account, so they
 * are at least a contact — leaving the stage empty would drop them out of the
 * funnel metrics that group by stage. `status` starts at 'prospecto' for the
 * same reason: converting says nothing about whether they have invested.
 */
export const NEW_INVESTOR_PIPELINE_STAGE = "contacto";
export const NEW_INVESTOR_STATUS = "prospecto";

/** Emails are compared case-insensitively; nobody types their own the same way twice. */
export function normalizeEmail(email: string | null | undefined): string {
  return email?.trim().toLowerCase() ?? "";
}
