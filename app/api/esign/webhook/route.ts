import { NextResponse } from "next/server";
import { es } from "@/i18n";
import { getEsignProvider } from "@/lib/esign/provider";
import {
  applySigningEvent,
  attachSignedDocument,
} from "@/lib/esign/signing-requests";
import {
  DOCUMENSO_SECRET_HEADER,
  isAuthenticWebhook,
  parseWebhookEvent,
} from "@/lib/esign/webhook-events";

/**
 * Documenso webhook — THE ONLY AUTHORITY ON WHETHER A CONTRACT IS SIGNED.
 *
 * Nothing the investor's browser does moves this state. The return URL after
 * signing exists purely so the person sees a sensible screen; it carries no
 * meaning, and the stepper keeps showing "processing" until an event lands here.
 *
 * Three barriers, in order:
 *
 *  1. AUTHENTICITY — the X-Documenso-Secret header must match
 *     ESIGN_WEBHOOK_SECRET, compared in constant time. Documenso uses a shared
 *     secret rather than an HMAC over the body (confirmed in their docs), so
 *     this is a secret comparison, not a signature check. No match, 401, no
 *     writes.
 *  2. MAPPING — the envelope id must match a signing_requests row WE created.
 *     An event for an unknown envelope is acknowledged and dropped, so a
 *     genuine-looking payload cannot attach a signature to an arbitrary
 *     investor.
 *  3. MONOTONICITY — only an event that advances the row is applied, which
 *     makes retries and out-of-order deliveries harmless.
 *
 * It answers 200 for anything it deliberately ignores. Documenso retries
 * non-2xx, and retrying an event that will never apply is noise, not safety.
 */
export async function POST(request: Request) {
  const expected = process.env.ESIGN_WEBHOOK_SECRET?.trim();

  if (!isAuthenticWebhook(request.headers.get(DOCUMENSO_SECRET_HEADER), expected)) {
    // Deliberately terse: a detailed refusal is a probing aid.
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  }

  const event = parseWebhookEvent(body);
  // Template events, reminders, anything we do not act on.
  if (!event) return NextResponse.json({ received: true, applied: false });

  const applied = await applySigningEvent(event);

  if (applied.outcome === "ignored") {
    return NextResponse.json({ received: true, applied: false, reason: applied.reason });
  }

  if (applied.status !== "completado") {
    // Rejected, cancelled or expired: the state moved, no document is filed,
    // and the admin can resend from the panel.
    return NextResponse.json({ received: true, applied: true, status: applied.status });
  }

  // Completed: fetch the signed PDF and file it.
  const provider = getEsignProvider();

  if (!provider.fetchSignedDocument) {
    return NextResponse.json({ received: true, applied: true, stored: false });
  }

  const fetched = await provider.fetchSignedDocument(event.externalDocumentId);

  if (!fetched.ok) {
    /**
     * The signature is real and already recorded as `completado`; only the file
     * is missing. Deliberately NOT a 500: making Documenso retry would replay
     * the whole event, and losing the completion because a download failed
     * would be far worse than a contract whose PDF has to be re-fetched.
     * `signed_document_id` stays null, which is exactly the state an admin
     * retry looks for.
     */
    console.error(
      `[esign:${provider.name}] completed but could not download ${event.externalDocumentId} — ${fetched.reason}`
    );
    return NextResponse.json({ received: true, applied: true, stored: false });
  }

  const stored = await attachSignedDocument({
    row: applied.row,
    artifacts: fetched.artifacts,
    documentName: es.investmentOnboarding.contract.previewTitle,
  });

  if (!stored.ok) {
    console.error(
      `[esign:${provider.name}] could not file the contract for ${event.externalDocumentId} — ${stored.reason}`
    );
    return NextResponse.json({ received: true, applied: true, stored: false });
  }

  return NextResponse.json({ received: true, applied: true, stored: true });
}
