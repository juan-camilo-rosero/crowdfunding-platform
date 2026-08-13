import "server-only";
import { createDocumensoEsignProvider } from "./providers/documenso";
import { createMockEsignProvider } from "./providers/mock";
import type { EsignProvider } from "./types";

/**
 * Switchable e-signature provider, following lib/ai/provider.ts.
 *
 * Chosen by ESIGN_PROVIDER; defaults to the mock, so the investment onboarding
 * works end to end before any signing vendor is contracted.
 *
 * `server-only` makes it a build error to import this from a client component,
 * so ESIGN_API_KEY can never reach a browser bundle.
 *
 * Environment:
 *   ESIGN_PROVIDER         "mock" (default) | "documenso"
 *   ESIGN_PROVIDER_URL     API base, e.g. https://app.documenso.com/api/v2 for
 *                          Cloud or https://your-host/api/v2 self-hosted. Same
 *                          code path either way; only the host differs.
 *   ESIGN_API_KEY          server-only, never NEXT_PUBLIC_. Sent as a BARE
 *                          token in Authorization, without "Bearer".
 *   ESIGN_WEBHOOK_SECRET   compared against the X-Documenso-Secret header
 *   ESIGN_DOWNLOAD_PATH_TEMPLATE  optional override of the download path
 */

let cached: EsignProvider | null = null;
let cachedKey: string | null = null;

function envFingerprint(): string {
  return [
    process.env.ESIGN_PROVIDER,
    process.env.ESIGN_PROVIDER_URL,
    process.env.ESIGN_API_KEY,
  ].join("|");
}

function resolveProvider(): EsignProvider {
  const configured = process.env.ESIGN_PROVIDER?.trim().toLowerCase();

  if (configured === "documenso") {
    const url = process.env.ESIGN_PROVIDER_URL?.trim();
    const apiKey = process.env.ESIGN_API_KEY?.trim();

    if (!url || !apiKey) {
      console.info(
        "[esign] falling back to the mock provider — ESIGN_PROVIDER_URL or ESIGN_API_KEY is not set"
      );
      return createMockEsignProvider();
    }

    return createDocumensoEsignProvider(url, apiKey);
  }

  return createMockEsignProvider();
}

/** The active provider. Re-resolved whenever the relevant env changes. */
export function getEsignProvider(): EsignProvider {
  const key = envFingerprint();
  if (!cached || cachedKey !== key) {
    cached = resolveProvider();
    cachedKey = key;
  }
  return cached;
}

/** Test seam: drops the memoised provider. */
export function resetEsignProvider(): void {
  cached = null;
  cachedKey = null;
}

export type { EsignProvider, SigningRequest, SigningSubject } from "./types";
