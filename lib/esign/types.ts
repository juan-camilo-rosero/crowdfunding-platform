/**
 * Electronic signature, provider-agnostic.
 *
 * The rest of the app talks to these shapes and never to a vendor SDK. Swapping
 * the mock for Documenso means writing one adapter, not touching the flow.
 */

/** Who is signing what. Built on the server from the session, never from a payload. */
export type SigningSubject = {
  userId: string;
  investorId: string;
  /** Shown to the signer and stored as documents.name. */
  documentName: string;
  signerEmail: string | null;
  signerName: string | null;
};

/**
 * What happens when a signing request is created.
 *
 * Same two-shape design as identity (lib/identity/types.ts), for the same
 * reason: the mock resolves immediately so the flow is demoable, while a real
 * provider hands back a URL and reports back later at /api/esign/webhook. Both
 * funnel into ONE state transition, so connecting Documenso does not add a
 * second way for a contract to become signed.
 */
export type SigningRequest =
  | { status: "signed"; envelopeId: string; fileUrl: string; signedAt: string }
  | { status: "pending"; envelopeId: string; signingUrl: string }
  | { status: "failed"; reason: string };

export type EsignProvider = {
  /** Provider name, for logs. Never shown to the user. */
  readonly name: string;
  /**
   * Creates the signing request. MUST NOT throw: every failure comes back as a
   * result, so a caller can never be broken by the vendor layer.
   */
  createSigningRequest: (subject: SigningSubject) => Promise<SigningRequest>;
};
