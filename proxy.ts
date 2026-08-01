import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { AuthErrorCode } from "@/lib/auth/auth-errors";
import { CATALOG_ROUTE, ONBOARDING_ROUTE, homeRouteFor } from "@/lib/auth/routes";
import { isRole, isUserStatus } from "@/types/user";

// (auth) routes: no session required.
// "/callback" MUST be public: it is where Google's `code` is exchanged for a
// session, and at that point the user has no session cookies yet.
const PUBLIC_PATHS = ["/login", "/callback"];

// "/" is public and handled separately (exact match, not by prefix): today a
// redirector, tomorrow the public landing page. See app/page.tsx.
const ROOT_PATH = "/";

// (admin)/admin/*: admin role only.
const ADMIN_PATH = "/admin";

// Public catalog + profile: visitors and investors have equal access.
const CATALOG_PATHS = [CATALOG_ROUTE, "/proyecto", "/perfil"];

// Investor-only routes (admins included); a visitor must not reach these.
const INVESTOR_ONLY_PATHS = [
  "/inicio",
  "/mis-inversiones",
  "/transacciones",
  "/documentos",
  "/solicitudes",
];

function isPathUnder(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not run logic between createServerClient() and auth.getUser(): getUser()
  // is what actually refreshes the session and rewrites cookies through setAll.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const redirectTo = (path: string) =>
    NextResponse.redirect(new URL(path, request.url));
  const redirectToLogin = (code: AuthErrorCode) => {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", code);
    return NextResponse.redirect(url);
  };

  if (pathname === ROOT_PATH || PUBLIC_PATHS.some((p) => isPathUnder(pathname, p))) {
    return response;
  }

  if (!user) {
    return redirectToLogin("session-required");
  }

  // Second query (profile): real authorization also lives in the backend and in
  // RLS; this proxy is the first barrier, not the only one (see code-patterns.md).
  const { data: profile } = await supabase
    .from("users")
    .select("role, status, onboarding_completed")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return redirectToLogin("profile-not-found");
  }

  const role = isRole(profile.role) ? profile.role : null;
  const status = isUserStatus(profile.status) ? profile.status : null;

  if (!role || !status) {
    return redirectToLogin("profile-not-found");
  }

  if (status === "suspendido") {
    return redirectToLogin("account-suspended");
  }

  if (status === "desactivado") {
    return redirectToLogin("account-deactivated");
  }

  if (status === "invitado") {
    // Should not happen: an invited user has no auth.users row until their first
    // login, at which point they become "registrado". Denied here for safety.
    return redirectToLogin("session-required");
  }

  // -- Basic onboarding gate ------------------------------------------------
  // Runs BEFORE the role checks: basic onboarding is done by EVERY authenticated
  // user regardless of role (everyone starts as `visitante`). Blocking
  // non-investors here left every new user without a valid destination.
  const isOnboardingRoute = isPathUnder(pathname, ONBOARDING_ROUTE);

  if (!profile.onboarding_completed) {
    return isOnboardingRoute ? response : redirectTo(ONBOARDING_ROUTE);
  }

  // Already onboarded: no reason to land back on that screen.
  if (isOnboardingRoute) {
    return redirectTo(homeRouteFor(role));
  }
  // -------------------------------------------------------------------------

  if (isPathUnder(pathname, ADMIN_PATH)) {
    if (role !== "admin") {
      return redirectTo(homeRouteFor(role));
    }
    return response;
  }

  // Admins see everything (permission matrix, user-management.md).
  if (role === "admin") {
    return response;
  }

  if (CATALOG_PATHS.some((p) => isPathUnder(pathname, p))) {
    return response;
  }

  if (INVESTOR_ONLY_PATHS.some((p) => isPathUnder(pathname, p))) {
    if (role !== "inversionista") {
      return redirectTo(homeRouteFor(role));
    }
    return response;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
