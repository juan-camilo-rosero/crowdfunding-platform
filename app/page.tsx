import { redirect } from "next/navigation";
import { LOGIN_ROUTE, ONBOARDING_ROUTE, homeRouteFor } from "@/lib/auth/routes";
import { getCurrentUser, getCurrentUserProfile } from "@/lib/auth/session";

/**
 * MOUNT POINT FOR THE PUBLIC LANDING PAGE (future).
 *
 * Today this route renders nothing: it only decides where to send the user.
 *   - no session                     -> /login
 *   - basic onboarding pending       -> /onboarding  (any role)
 *   - onboarded visitor              -> /portafolio
 *   - onboarded investor/admin       -> /inicio
 *
 * Once the fundraising landing exists, this file renders it and the redirect
 * logic moves to the "Sign in" button (or stays only for authenticated users).
 * proxy.ts keeps "/" public precisely for that.
 */
export default async function Page() {
  const user = await getCurrentUser();

  if (!user) {
    redirect(LOGIN_ROUTE);
  }

  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect(`${LOGIN_ROUTE}?error=profile-not-found`);
  }

  redirect(
    profile.onboarding_completed ? homeRouteFor(profile.role) : ONBOARDING_ROUTE
  );
}
