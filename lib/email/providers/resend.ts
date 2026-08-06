import type { EmailMessage, EmailProvider, EmailResult } from "../types";

/** Resend's REST endpoint. Called directly: no SDK dependency to carry. */
const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Resend adapter.
 *
 * Everything vendor-specific is confined here — the endpoint, the auth header
 * and the payload shape. Another provider is another file next to this one.
 *
 * The API key is read by the caller from a server-only env var and passed in;
 * it never appears in a NEXT_PUBLIC_ variable and this module is never imported
 * from a client component.
 */
export function createResendProvider(
  apiKey: string,
  defaultFrom: string
): EmailProvider {
  return {
    name: "resend",
    async send(message: EmailMessage): Promise<EmailResult> {
      try {
        const response = await fetch(RESEND_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: message.from ?? defaultFrom,
            to: Array.isArray(message.to) ? message.to : [message.to],
            subject: message.subject,
            text: message.text,
            ...(message.html ? { html: message.html } : {}),
            ...(message.replyTo ? { reply_to: message.replyTo } : {}),
          }),
        });

        if (!response.ok) {
          // The body may carry a reason; never let a parse error escape.
          const detail = await response.text().catch(() => "");
          return {
            status: "failed",
            reason: `resend ${response.status} ${detail.slice(0, 200)}`,
          };
        }

        const payload = (await response.json().catch(() => ({}))) as {
          id?: string;
        };
        return { status: "sent", id: payload.id };
      } catch (error) {
        // Contract: send() never throws.
        return {
          status: "failed",
          reason: error instanceof Error ? error.message : "network error",
        };
      }
    },
  };
}
