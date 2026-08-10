import { createServerClient } from "@supabase/ssr";
import { createClient } from "./server";
import type { Database } from "@/types/database";

/**
 * A Supabase client for a route handler, whatever the caller is.
 *
 * The web app authenticates with cookies (@supabase/ssr). A native app cannot:
 * it holds the session itself and sends `Authorization: Bearer <access_token>`.
 * Rather than build a second endpoint for mobile later, endpoints accept both
 * from the start and derive the identity from whichever arrived.
 *
 * Either way the client runs AS THE USER, so RLS applies exactly the same. The
 * service role is never used here — it would bypass the only barrier standing
 * between one investor and another's data.
 */

/** The bearer token on this request, if it carries one. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;

  const [scheme, ...rest] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer") return null;

  const token = rest.join(" ").trim();
  return token.length > 0 ? token : null;
}

export type RequestClient = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  /** Present only on the Bearer path; the identity check needs it explicitly. */
  token: string | null;
};

export async function createRequestClient(
  request: Request
): Promise<RequestClient> {
  const token = bearerToken(request);

  // Cookies: the browser. proxy.ts has already refreshed the session.
  if (!token) {
    return { supabase: await createClient(), token: null };
  }

  // Bearer: a native client. No cookie store to read or write — the token is
  // the whole session, and passing it as a global header is what makes
  // PostgREST evaluate RLS as this user.
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  );

  return { supabase, token };
}
