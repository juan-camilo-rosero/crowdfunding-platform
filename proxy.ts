import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { AuthErrorCode } from "@/lib/auth/auth-errors";
import {
  ADMIN_HOME_ROUTE,
  CATALOG_ROUTE,
  ONBOARDING_ROUTE,
  homeRouteFor,
} from "@/lib/auth/routes";
import { isRole, isUserStatus } from "@/types/user";

// (auth) routes: no session required.
// "/callback" MUST be public: it is where Google's `code` is exchanged for a
// session, and at that point the user has no session cookies yet.
const PUBLIC_PATHS = ["/login", "/callback"];

// "/" is public and handled separately (exact match, not by prefix): today a
// redirector, tomorrow the public landing page. See app/page.tsx.
const ROOT_PATH = "/";

// (admin)/admin/*: requires role = 'admin'. Having investments grants nothing here.
const ADMIN_PATH = ADMIN_HOME_ROUTE;

// Public catalog + profile: any authenticated, onboarded user.
const CATALOG_PATHS = [CATALOG_ROUTE, "/proyecto", "/perfil"];

// Investor-section routes: reachable with the investor link OR the admin role.
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
  // Plain redirect to /login. Reaching the sign-in screen is self-explanatory,
  // so no message is shown for it; only real failures carry an `?error=` code.
  const redirectToLogin = () => NextResponse.redirect(new URL("/login", request.url));
  const redirectToLoginWithError = (code: AuthErrorCode) => {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", code);
    return NextResponse.redirect(url);
  };

  if (pathname === ROOT_PATH || PUBLIC_PATHS.some((p) => isPathUnder(pathname, p))) {
    return response;
  }

  if (!user) {
    return redirectToLogin();
  }

  // Second query (profile): real authorization also lives in the backend and in
  // RLS; this proxy is the first barrier, not the only one (see code-patterns.md).
  const { data: profile } = await supabase
    .from("users")
    .select("role, status, onboarding_completed")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return redirectToLoginWithError("profile-not-found");
  }

  const role = isRole(profile.role) ? profile.role : null;
  const status = isUserStatus(profile.status) ? profile.status : null;

  if (!role || !status) {
    return redirectToLoginWithError("profile-not-found");
  }

  if (status === "suspendido") {
    return redirectToLoginWithError("account-suspended");
  }

  if (status === "desactivado") {
    return redirectToLoginWithError("account-deactivated");
  }

  if (status === "invitado") {
    // Should not happen: an invited user has no auth.users row until their first
    // login, at which point they become "registrado". Denied here for safety.
    return redirectToLogin();
  }

  const isAdmin = role === "admin";

  // Investor capability is derived from the link in `investors`. Resolved lazily
  // so the extra query only runs on the requests that actually need it.
  let investorLinkChecked = false;
  let investorLinked = false;
  const isInvestor = async () => {
    if (!investorLinkChecked) {
      // Explicit user_id filter is required: RLS lets an admin read every
      // investors row, so without it every admin would look like an investor.
      const { data } = await supabase
        .from("investors")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);
      investorLinked = !!data && data.length > 0;
      investorLinkChecked = true;
    }
    return investorLinked;
  };

  const homeRoute = async () =>
    homeRouteFor({
      isAdmin,
      isInvestor: await isInvestor(),
      onboardingCompleted: profile.onboarding_completed,
    });

  // -- Basic onboarding gate ------------------------------------------------
  // Runs BEFORE the capability checks: basic onboarding is done by EVERY
  // authenticated user (everyone starts with no capabilities at all). Blocking
  // anyone here left every new user without a valid destination.
  const isOnboardingRoute = isPathUnder(pathname, ONBOARDING_ROUTE);

  if (!profile.onboarding_completed) {
    return isOnboardingRoute ? response : redirectTo(ONBOARDING_ROUTE);
  }

  // Already onboarded: no reason to land back on that screen.
  if (isOnboardingRoute) {
    return redirectTo(await homeRoute());
  }
  // -------------------------------------------------------------------------

  // /admin/* requires the admin role; investments grant nothing here.
  if (isPathUnder(pathname, ADMIN_PATH)) {
    return isAdmin ? response : redirectTo(await homeRoute());
  }

  // Catalog and profile: open to any onboarded user.
  if (CATALOG_PATHS.some((p) => isPathUnder(pathname, p))) {
    return response;
  }

  // Investor routes: the investor link OR the admin role gets in, because the
  // admin sees everything (user-management.md). An admin with no contributions
  // sees these screens empty, which is valid information.
  if (INVESTOR_ONLY_PATHS.some((p) => isPathUnder(pathname, p))) {
    return isAdmin || (await isInvestor())
      ? response
      : redirectTo(await homeRoute());
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
