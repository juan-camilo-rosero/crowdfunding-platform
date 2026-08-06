import type { EmailMessage, EmailProvider, EmailResult } from "../types";

/**
 * The default provider: sends nothing.
 *
 * This is what makes email OPTIONAL. With no key configured the app must still
 * work end to end — an investor registering interest gets their confirmation
 * whether or not the team has wired a mail vendor yet. The message is logged so
 * it is visible in development, and the result says `skipped`, which is not an
 * error anywhere upstream.
 */
export function createNoopProvider(reason: string): EmailProvider {
  return {
    name: "noop",
    async send(message: EmailMessage): Promise<EmailResult> {
      console.info(
        `[email:noop] not sent (${reason}) — to=${
          Array.isArray(message.to) ? message.to.join(",") : message.to
        } subject="${message.subject}"`
      );
      return { status: "skipped", reason };
    },
  };
}
