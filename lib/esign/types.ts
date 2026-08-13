/**
 * Electronic signature, provider-agnostic.
 *
 * The rest of the app talks to these shapes and never to a vendor SDK. Swapping
 * the mock for Documenso means writing one adapter, not touching the flow.
 */

/** The PDF an admin prepared for this investment. */
export type ContractPdf = {
  fileName: string;
  /** Raw bytes. Never a URL: the file must not be reachable without auth. */
  bytes: Uint8Array;
};

/** Who is signing what. Built on the server, never from a client payload. */
export type SigningSubject = {
  userId: string;
  investorId: string;
  projectId: string | null;
  capitalContributionId: string | null;
  /** Shown to the signer and stored as documents.name. */
  documentName: string;
  signerEmail: string | null;
  signerName: string | null;
  /** Absent in mock mode, which needs no file to simulate a signature. */
  contractPdf?: ContractPdf;
};

/**
 * What happens when a signing request is created.
 *
 * Three shapes, because the two worlds genuinely differ:
 *
 *  - `signed` — the mock resolves immediately, so the flow stays demoable with
 *    no vendor and no account.
 *  - `pending` — Documenso created the envelope and returned a signing URL. The
 *    real outcome arrives later at /api/esign/webhook, and NOTHING is treated
 *    as signed until it does.
 *
 * Both funnel into ONE state transition, so connecting Documenso does not add a
 * second way for a contract to become signed.
 */
export type SigningRequest =
  | { status: "signed"; envelopeId: string; fileUrl: string; signedAt: string }
  | { status: "pending"; envelopeId: string; signingUrl: string }
  | { status: "failed"; reason: string };

/** The signed artefacts, fetched once the provider reports completion. */
export type SignedArtifacts = {
  /** The signed PDF. */
  document: { fileName: string; bytes: Uint8Array };
  /** Documenso's audit certificate, when the plan exposes it. */
  certificate?: { fileName: string; bytes: Uint8Array };
};

export type FetchSignedResult =
  | { ok: true; artifacts: SignedArtifacts }
  | { ok: false; reason: string };

export type EsignProvider = {
  /** Provider name, for logs. Never shown to the user. */
  readonly name: string;
  /**
   * Creates the signing request. MUST NOT throw: every failure comes back as a
   * result, so a caller can never be broken by the vendor layer.
   */
  createSigningRequest: (subject: SigningSubject) => Promise<SigningRequest>;
  /**
   * The signer's URL for an existing envelope, so a returning investor resumes
   * instead of starting a second envelope. Optional: the mock has none.
   */
  getSigningUrl?: (envelopeId: string) => Promise<string | null>;
  /**
   * Downloads the signed PDF once the provider reports completion. Optional for
   * the same reason — the mock produces its placeholder inline.
   */
  fetchSignedDocument?: (envelopeId: string) => Promise<FetchSignedResult>;
};
