import "server-only";
import type { JWK, SupabaseClient } from "@supabase/supabase-js";

/**
 * Verified identity of the caller, without a network round trip.
 *
 * WHY THIS EXISTS: `auth.getUser()` asks the Supabase Auth server to validate
 * the token, so it costs a full round trip — ~170ms from here — and it runs
 * TWICE per navigation (once in proxy.ts, once in the page). That was a quarter
 * of the time every screen took to appear.
 *
 * This is NOT the insecure shortcut. `getSession()` would simply trust whatever
 * is in the cookie; `getClaims()` verifies the JWT's SIGNATURE against the
 * project's public key with WebCrypto. This project signs with ES256
 * (asymmetric), so that verification is pure local computation — the same
 * guarantee as getUser(), minus the trip.
 *
 * The catch auth-js leaves to the caller: it caches the JWKS per client
 * INSTANCE, and a new client is created per request, so it would re-fetch the
 * key set every time and give the round trip straight back. The key set is
 * therefore cached here, at module level, and handed in explicitly.
 */

type Jwks = { keys: JWK[] };

/** How long the cached key set is trusted. Supabase rotates rarely. */
const JWKS_TTL_MS = 10 * 60 * 1000;

let cachedJwks: Jwks | null = null;
let cachedAt = 0;
/** In-flight fetch, so a burst of requests triggers one call, not N. */
let inFlight: Promise<Jwks | null> | null = null;

async function getJwks(client: SupabaseClient): Promise<Jwks | null> {
  const now = Date.now();
  if (cachedJwks && now - cachedAt < JWKS_TTL_MS) return cachedJwks;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      // Asking with no cached key set makes auth-js fetch and remember it on
      // this instance; the result is lifted out for reuse across requests.
      await client.auth.getClaims();
      const jwks = (
        client.auth as unknown as { jwks?: Jwks }
      ).jwks;

      if (jwks?.keys?.length) {
        cachedJwks = jwks;
        cachedAt = Date.now();
        return jwks;
      }
      return null;
    } catch {
      return null;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

export type VerifiedUser = { id: string; email: string | null };

/**
 * The authenticated user, or null.
 *
 * Falls back to `getUser()` whenever local verification cannot be completed —
 * a symmetric-key project, a cold key set, a WebCrypto gap. A slow answer is
 * always preferable to logging somebody out over an optimisation.
 */
export async function getVerifiedUser(
  client: SupabaseClient
): Promise<VerifiedUser | null> {
  try {
    const jwks = await getJwks(client);

    if (jwks) {
      const { data, error } = await client.auth.getClaims(undefined, { jwks });
      if (!error && data?.claims?.sub) {
        return {
          id: data.claims.sub,
          email: (data.claims.email as string | undefined) ?? null,
        };
      }
    }
  } catch {
    // Fall through to the authoritative check.
  }

  const {
    data: { user },
  } = await client.auth.getUser();

  return user ? { id: user.id, email: user.email ?? null } : null;
}

/** Test seam: drops the cached key set. */
export function resetJwksCache(): void {
  cachedJwks = null;
  cachedAt = 0;
  inFlight = null;
}
