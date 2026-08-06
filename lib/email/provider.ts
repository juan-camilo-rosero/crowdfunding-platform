import "server-only";
import { createNoopProvider } from "./providers/noop";
import { createResendProvider } from "./providers/resend";
import type { EmailMessage, EmailProvider, EmailResult } from "./types";

/**
 * Switchable transactional-email provider, following lib/ai/provider.ts.
 *
 * Chosen by EMAIL_PROVIDER; defaults to a no-op. That default is the point:
 * email must never be a prerequisite for a feature to work. A screen that
 * records something and notifies the team keeps recording it whether or not a
 * mail vendor is configured, and the user's confirmation does not depend on it.
 *
 * `server-only` makes it a build error to import this from a client component,
 * so RESEND_API_KEY cannot end up in a browser bundle by accident.
 *
 * Environment:
 *   EMAIL_PROVIDER          "resend" | "none" (default: inferred, see below)
 *   RESEND_API_KEY          server-only, never NEXT_PUBLIC_
 *   EMAIL_FROM              default sender, e.g. "Investors 180 <no-reply@…>"
 *   INTEREST_NOTIFICATION_TO  where interest notices go
 *   SEND_INTEREST_CONFIRMATION  "true" to also confirm to the user (off by default)
 */

/**
 * Resend's sandbox sender. It needs no verified domain, which is what lets the
 * feature work with nothing but an API key — but Resend only delivers from it
 * to the address that owns the account, so real recipients need EMAIL_FROM
 * pointing at a verified domain.
 */
const SANDBOX_SENDER = "Investors 180 <onboarding@resend.dev>";

let cached: EmailProvider | null = null;
/**
 * The env that produced `cached`.
 *
 * Memoising on its own was a trap: Next reloads .env.local on change, but a
 * provider resolved before that edit keeps the old key and sender until the
 * server is restarted — so fixing a misconfiguration appeared to do nothing.
 * Keying the cache on the values means an env edit takes effect on the next
 * send, while still resolving once per configuration.
 */
let cachedKey: string | null = null;

function envFingerprint(): string {
  return [
    process.env.EMAIL_PROVIDER,
    process.env.RESEND_API_KEY,
    process.env.EMAIL_FROM,
  ].join("|");
}

/**
 * The From address. A missing EMAIL_FROM used to disable sending entirely;
 * falling back to the sandbox sender instead means a deployment that has only
 * set RESEND_API_KEY still gets mail out, which is the far more useful default.
 */
function resolveSender(): string {
  const from = process.env.EMAIL_FROM?.trim();
  if (from) return from;

  console.info(
    `[email] EMAIL_FROM is not set — falling back to ${SANDBOX_SENDER}. ` +
      "Resend only delivers from it to the account owner's address; set " +
      "EMAIL_FROM to a verified domain to reach anyone else."
  );
  return SANDBOX_SENDER;
}

function resolveProvider(): EmailProvider {
  const configured = process.env.EMAIL_PROVIDER?.trim().toLowerCase();

  // An explicit opt-out always wins, so a deployment can silence email without
  // removing its credentials.
  if (configured === "none") {
    return createNoopProvider("EMAIL_PROVIDER=none");
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();

  // With no provider named, having a key is taken as the intent to send.
  if ((configured === "resend" || !configured) && apiKey) {
    return createResendProvider(apiKey, resolveSender());
  }

  if (configured === "resend" && !apiKey) {
    return createNoopProvider("RESEND_API_KEY is not set");
  }

  return createNoopProvider("no email provider configured");
}

/** The active provider. Re-resolved whenever the relevant env changes. */
export function getEmailProvider(): EmailProvider {
  const key = envFingerprint();
  if (!cached || cachedKey !== key) {
    cached = resolveProvider();
    cachedKey = key;
  }
  return cached;
}

/** Test seam: drops the memoised provider. */
export function resetEmailProvider(): void {
  cached = null;
  cachedKey = null;
}

/**
 * Sends a message and NEVER lets a mail problem reach the caller.
 *
 * This is the function features should use. Even though providers promise not
 * to throw, this wraps them anyway: an unconfigured provider, a network blip or
 * a bug in an adapter must not turn a successful database write into a failure
 * the user sees. The database write is the source of truth; the email is a
 * courtesy.
 */
export async function sendTransactionalEmail(
  message: EmailMessage
): Promise<EmailResult> {
  const provider = getEmailProvider();

  try {
    const result = await provider.send(message);
    if (result.status === "failed") {
      console.error(`[email:${provider.name}] failed — ${result.reason}`);
    }
    return result;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    console.error(`[email:${provider.name}] threw — ${reason}`);
    return { status: "failed", reason };
  }
}

export type { EmailMessage, EmailProvider, EmailResult };
