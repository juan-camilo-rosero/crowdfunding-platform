/**
 * Authentication error codes carried in the `?error=` query param to /login.
 * This module intentionally has NO imports: it is consumed by server code
 * (proxy.ts, the OAuth callback) and by Client Components alike, and importing
 * `next/headers` here would break the browser bundle.
 */
export const AUTH_ERROR_CODES = [
  "session-required",
  "missing-code",
  "exchange-failed",
  "provider-rejected",
  "profile-not-found",
  "account-suspended",
  "account-deactivated",
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

export function isAuthErrorCode(value: string): value is AuthErrorCode {
  return (AUTH_ERROR_CODES as readonly string[]).includes(value);
}
