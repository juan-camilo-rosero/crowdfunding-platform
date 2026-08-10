import "server-only";
import { createMockIdentityProvider } from "./providers/mock";
import { createTruoraIdentityProvider } from "./providers/truora";
import type { IdentityProvider } from "./types";

/**
 * Switchable identity-verification provider, following lib/ai/provider.ts.
 *
 * Chosen by IDENTITY_PROVIDER; defaults to the mock. That default is the point:
 * the whole investment onboarding — eligibility, state transitions, stepper,
 * banner — must work end to end before a paid verification vendor is turned on,
 * and integrations.md says Truora can stay off by configuration.
 *
 * `server-only` makes it a build error to import this from a client component,
 * so TRUORA_API_KEY can never reach a browser bundle.
 *
 * Environment:
 *   IDENTITY_PROVIDER      "mock" (default) | "truora"
 *   IDENTITY_MOCK_OUTCOME  mock only: "aprobado" (default) | "rechazado" | "expirado"
 *   TRUORA_API_KEY         server-only, never NEXT_PUBLIC_
 *   TRUORA_ACCOUNT_ID      must match [a-zA-Z0-9_.-]+
 */

let cached: IdentityProvider | null = null;
/** See lib/ai/provider.ts: memoising without this hides an env fix. */
let cachedKey: string | null = null;

function envFingerprint(): string {
  return [
    process.env.IDENTITY_PROVIDER,
    process.env.TRUORA_API_KEY,
    process.env.TRUORA_ACCOUNT_ID,
  ].join("|");
}

function resolveProvider(): IdentityProvider {
  const configured = process.env.IDENTITY_PROVIDER?.trim().toLowerCase();

  if (configured === "truora") {
    const apiKey = process.env.TRUORA_API_KEY?.trim();
    const accountId = process.env.TRUORA_ACCOUNT_ID?.trim();

    if (!apiKey || !accountId) {
      console.info(
        "[identity] falling back to the mock provider — TRUORA_API_KEY or TRUORA_ACCOUNT_ID is not set"
      );
      return createMockIdentityProvider();
    }

    return createTruoraIdentityProvider();
  }

  return createMockIdentityProvider();
}

/** The active provider. Re-resolved whenever the relevant env changes. */
export function getIdentityProvider(): IdentityProvider {
  const key = envFingerprint();
  if (!cached || cachedKey !== key) {
    cached = resolveProvider();
    cachedKey = key;
  }
  return cached;
}

/** Test seam: drops the memoised provider. */
export function resetIdentityProvider(): void {
  cached = null;
  cachedKey = null;
}

export type {
  IdentityProvider,
  VerificationOutcome,
  VerificationStart,
  VerificationStatus,
} from "./types";
