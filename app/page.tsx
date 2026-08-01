import { redirect } from "next/navigation";
import { LOGIN_ROUTE, homeRouteFor } from "@/lib/auth/routes";
import { getCapabilities, getCurrentUser } from "@/lib/auth/session";

/**
 * MOUNT POINT FOR THE PUBLIC LANDING PAGE (future).
 *
 * Today this route renders nothing: it only decides where to send the user.
 *   - no session                       -> /login
 *   - basic onboarding pending         -> /onboarding  (everyone)
 *   - has investor link                -> /inicio
 *   - admin without investor link      -> /admin
 *   - neither                          -> /portafolio
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

  const capabilities = await getCapabilities();

  if (!capabilities) {
    redirect(`${LOGIN_ROUTE}?error=profile-not-found`);
  }

  redirect(homeRouteFor(capabilities));
}
