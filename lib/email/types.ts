/**
 * Transactional email, provider-agnostic.
 *
 * The rest of the app talks to this shape and never to a vendor SDK, the same
 * way lib/ai/provider.ts hides the chat provider. Swapping Resend for Postmark
 * means writing one adapter, not touching any caller.
 */

export type EmailMessage = {
  to: string | string[];
  subject: string;
  /** Plain-text body. Always provide it: some clients never render HTML. */
  text: string;
  /** Optional richer body. */
  html?: string;
  /** Overrides EMAIL_FROM for this message. */
  from?: string;
  replyTo?: string;
};

/**
 * What happened. Never throws — see EmailProvider.
 *
 * `skipped` is a first-class outcome, not a failure: with no provider
 * configured the app is expected to keep working silently.
 */
export type EmailResult =
  | { status: "sent"; id?: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

export type EmailProvider = {
  /** Provider name, for logs. */
  readonly name: string;
  /**
   * Sends a message. MUST NOT throw: every failure comes back as a result, so
   * a caller can never be broken by the mail layer.
   */
  send: (message: EmailMessage) => Promise<EmailResult>;
};
