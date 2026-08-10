/**
 * Identity verification, provider-agnostic.
 *
 * The rest of the app talks to these shapes and never to a vendor SDK, the same
 * way lib/ai/types.ts hides the chat provider. Swapping the mock for Truora
 * means writing one adapter, not touching the flow or the UI.
 */

/** Stored verbatim in identity_verifications.status (Spanish, per the CHECK). */
export type VerificationStatus = "iniciado" | "aprobado" | "rechazado" | "expirado";

/** What the provider decided. The ONLY thing that moves a user to verified. */
export type VerificationOutcome =
  | { status: "aprobado" }
  | { status: "rechazado"; declineReason: string }
  | { status: "expirado"; declineReason: string };

/**
 * What happens when a verification begins.
 *
 * Two shapes on purpose, because the two worlds genuinely differ:
 *
 *  - `resolved` — the mock answers immediately, so the flow can be built and
 *    demoed end to end with no vendor.
 *  - `pending` — Truora hands back a web-integration URL, the user goes there,
 *    and the result arrives later at /api/truora/webhook.
 *
 * Both funnel into the SAME state transition (lib/identity/verification.ts), so
 * connecting the real provider does not add a second way for a user to become
 * verified.
 */
export type VerificationStart =
  | { status: "resolved"; processId: string; outcome: VerificationOutcome }
  | { status: "pending"; processId: string; redirectUrl: string }
  | { status: "failed"; reason: string };

export type IdentityProvider = {
  /** Provider name, for logs. Never shown to the user. */
  readonly name: string;
  /**
   * Begins a verification for one user. MUST NOT throw: every failure comes
   * back as a result, so a caller can never be broken by the vendor layer.
   *
   * `userId` comes from the session on the server. It is passed in rather than
   * read here so this module never touches auth.
   */
  startVerification: (userId: string) => Promise<VerificationStart>;
};
