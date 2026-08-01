import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AuthErrorCode } from "@/lib/auth/auth-errors";
import { ONBOARDING_ROUTE, homeRouteFor } from "@/lib/auth/routes";
import { isRole } from "@/types/user";

/**
 * Google OAuth callback. Receives the PKCE `code`, exchanges it for a session
 * (the @supabase/ssr client writes the cookies) and picks the destination:
 *   - onboarding_completed = false -> /onboarding
 *   - onboarding_completed = true  -> /portafolio (visitor) or /inicio
 *
 * A suspended or deactivated user does NOT get in even with a valid OAuth login
 * (user-management.md): the freshly created session is signed out immediately.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  // In production behind Vercel's proxy, `origin` may be the internal host.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const baseUrl =
    process.env.NODE_ENV === "development" || !forwardedHost
      ? origin
      : `https://${forwardedHost}`;

  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, baseUrl));
  const backToLogin = (code: AuthErrorCode) => redirectTo(`/login?error=${code}`);

  // Google/Supabase return `error` when the person cancels or denies access.
  if (searchParams.get("error")) {
    return backToLogin("provider-rejected");
  }

  const code = searchParams.get("code");
  if (!code) {
    return backToLogin("missing-code");
  }

  const supabase = await createClient();

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return backToLogin("exchange-failed");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return backToLogin("exchange-failed");
  }

  // The row is created by the handle_new_user trigger on auth.users insert.
  const { data: profile } = await supabase
    .from("users")
    .select("role, status, onboarding_completed")
    .eq("id", user.id)
    .single();

  if (!profile || !isRole(profile.role)) {
    return backToLogin("profile-not-found");
  }

  if (profile.status === "suspendido") {
    await supabase.auth.signOut();
    return backToLogin("account-suspended");
  }

  if (profile.status === "desactivado") {
    await supabase.auth.signOut();
    return backToLogin("account-deactivated");
  }

  // Basic onboarding pending -> any role goes through it. Already done -> the
  // role's home: visitors to the catalog, investors/admins to /inicio.
  return redirectTo(
    profile.onboarding_completed ? homeRouteFor(profile.role) : ONBOARDING_ROUTE
  );
}
