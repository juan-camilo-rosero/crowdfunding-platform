/**
 * The admin's user directory, and the linking funnel inside it.
 *
 * Being an investor is DERIVED from a row in `investors` pointing at the
 * user_id — never from users.role. So "converting" someone means creating or
 * connecting that row, and nothing else: role stays 'visitante', which is
 * correct, because role only measures the administrative level.
 */

export type UserDirectoryEntry = {
  id: string;
  fullName: string | null;
  email: string;
  phone: string | null;
  /** When they signed up. */
  createdAt: string;

  /**
   * The two capabilities, as INDEPENDENT axes rather than one state.
   *
   * user-management.md is explicit that they coexist — the owner runs the
   * business and has also invested. Collapsing them into a single "state" would
   * lose that account and contradict how the rest of the app authorises.
   */
  isAdmin: boolean;
  isInvestor: boolean;

  /** Basic onboarding. Without it there is no name or phone to seed a record. */
  onboardingCompleted: boolean;

  /**
   * True when an UNLINKED row already exists in `investors` with this email —
   * an admin invited them first (Camino A) and the two halves have not met yet.
   * Converting will CONNECT that row instead of creating a second one.
   */
  hasMatchingProspect: boolean;

  /**
   * Whether the convert action would succeed. Mirrors exactly what the Server
   * Action checks, so the button never offers something the server refuses.
   */
  canConvert: boolean;
};

/** Why a row has no convert button. Drives the reason shown in its place. */
export type NotConvertibleReason = "already-investor" | "is-admin" | "onboarding-pending";

export function notConvertibleReason(
  entry: UserDirectoryEntry
): NotConvertibleReason | null {
  if (entry.canConvert) return null;
  if (entry.isInvestor) return "already-investor";
  if (entry.isAdmin) return "is-admin";
  return "onboarding-pending";
}

/** Filter of the directory, by capability. */
export type DirectoryFilter = "todos" | "visitante" | "inversionista" | "admin";

export function matchesFilter(
  entry: UserDirectoryEntry,
  filter: DirectoryFilter
): boolean {
  switch (filter) {
    case "admin":
      return entry.isAdmin;
    case "inversionista":
      return entry.isInvestor;
    // A visitor is someone with NEITHER capability — the people this screen
    // exists to move forward.
    case "visitante":
      return !entry.isAdmin && !entry.isInvestor;
    default:
      return true;
  }
}

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
