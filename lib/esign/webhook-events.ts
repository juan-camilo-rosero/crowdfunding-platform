import crypto from "node:crypto";

/**
 * Reading and authenticating a Documenso webhook.
 *
 * Pure functions, so the rules that decide whether an event is genuine and what
 * it means can be tested without a database or a network.
 *
 * VERIFIED AGAINST docs.documenso.com (August 2026): Documenso does NOT sign
 * the body with an HMAC. It sends the webhook secret verbatim in the
 * `X-Documenso-Secret` header, and the docs instruct receivers to compare it
 * with a constant-time comparison — their own Node example uses
 * `crypto.timingSafeEqual`. Assuming HMAC here (as Stripe or GitHub would) and
 * verifying a signature that never arrives would have rejected every real
 * event; it was worth confirming rather than guessing.
 */

export const DOCUMENSO_SECRET_HEADER = "x-documenso-secret";

/**
 * Constant-time secret comparison.
 *
 * `timingSafeEqual` throws when the buffers differ in length, which would leak
 * the secret's length through the difference between a throw and a false — so
 * the lengths are equalised by hashing both sides first. A missing or empty
 * header is rejected outright: Documenso sends an empty string when no secret
 * is configured, and an endpoint that accepts that accepts anybody.
 */
export function isAuthenticWebhook(
  receivedSecret: string | null | undefined,
  expectedSecret: string | undefined
): boolean {
  if (!receivedSecret || !expectedSecret) return false;

  const digest = (value: string) =>
    crypto.createHash("sha256").update(value, "utf8").digest();

  try {
    return crypto.timingSafeEqual(digest(receivedSecret), digest(expectedSecret));
  } catch {
    return false;
  }
}

/** Our tracking states, matching the CHECK on signing_requests.status. */
export type SigningStatus =
  | "enviado"
  | "entregado"
  | "completado"
  | "rechazado"
  | "anulado"
  | "expirado";

/**
 * Documenso's event names, as listed in their webhook docs.
 *
 * Events not mapped here (template events, reminders) are legitimate but say
 * nothing about whether a contract is signed, so they are acknowledged and
 * ignored rather than treated as an error.
 */
const EVENT_TO_STATUS: Record<string, SigningStatus> = {
  DOCUMENT_SENT: "enviado",
  DOCUMENT_OPENED: "entregado",
  DOCUMENT_SIGNED: "entregado",
  DOCUMENT_RECIPIENT_COMPLETED: "entregado",
  DOCUMENT_COMPLETED: "completado",
  DOCUMENT_REJECTED: "rechazado",
  DOCUMENT_CANCELLED: "anulado",
  RECIPIENT_EXPIRED: "expirado",
};

/**
 * How far along each state is.
 *
 * IDEMPOTENCY AND OUT-OF-ORDER DELIVERY IN ONE RULE: a webhook may be retried,
 * and two events may arrive in the wrong order. Applying only strictly forward
 * transitions means a repeat is a no-op and a late DOCUMENT_OPENED cannot undo
 * a DOCUMENT_COMPLETED that already landed.
 */
const RANK: Record<SigningStatus, number> = {
  enviado: 0,
  entregado: 1,
  // Terminal states share the top rank: whichever arrives first wins, and none
  // of them can be walked back by a later event.
  completado: 2,
  rechazado: 2,
  anulado: 2,
  expirado: 2,
};

export type WebhookEvent = {
  /** The envelope id, which is how the event is matched to our tracking row. */
  externalDocumentId: string;
  status: SigningStatus;
  declinedReason: string | null;
};

type RawPayload = {
  event?: string;
  createdAt?: string;
  payload?: {
    id?: string | number;
    envelopeId?: string;
    externalId?: string;
    status?: string;
    documentMeta?: { message?: string };
    rejectionReason?: string;
    recipients?: { rejectionReason?: string }[];
  };
};

/**
 * Turns a raw body into an event we act on, or null.
 *
 * Null means "acknowledge and do nothing" — an unknown event type, or a body
 * with no envelope id. Never an error: replying non-2xx would make Documenso
 * retry something that will never succeed.
 */
export function parseWebhookEvent(body: unknown): WebhookEvent | null {
  const raw = body as RawPayload;
  const status = raw?.event ? EVENT_TO_STATUS[raw.event] : undefined;
  if (!status) return null;

  // Documenso's v2 envelope id is preferred; `payload.id` is the legacy
  // numeric v1 id and is accepted so an older deployment still works.
  const id =
    raw.payload?.envelopeId ??
    raw.payload?.externalId ??
    (raw.payload?.id !== undefined ? String(raw.payload.id) : undefined);

  if (!id) return null;

  const declinedReason =
    status === "rechazado"
      ? (raw.payload?.rejectionReason ??
        raw.payload?.recipients?.find((r) => r.rejectionReason)?.rejectionReason ??
        null)
      : null;

  return { externalDocumentId: id, status, declinedReason };
}

/** Whether an incoming status actually advances a row. */
export function advances(current: SigningStatus, incoming: SigningStatus): boolean {
  return RANK[incoming] > RANK[current];
}
