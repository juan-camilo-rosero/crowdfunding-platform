/**
 * Canonical destinations of the authentication flow. Single source of truth for
 * proxy.ts, app/page.tsx and the OAuth callback: duplicating this rule is how it
 * drifts out of sync (exactly what caused the visitor-stuck-on-/portafolio bug).
 *
 * Destinations follow the CAPABILITY model, not a single role: being an admin
 * and being an investor are independent and can coexist on one account.
 * See the access matrix in .claude/docs/user-management.md.
 */
export const LOGIN_ROUTE = "/login";
export const ONBOARDING_ROUTE = "/onboarding";
export const CATALOG_ROUTE = "/portafolio";
export const INVESTOR_HOME_ROUTE = "/inicio";
/** Not an auth destination; kept here so the path has one spelling. */
export const MY_INVESTMENTS_ROUTE = "/mis-inversiones";
export const ADMIN_HOME_ROUTE = "/admin";

export type UserCapabilities = {
  /** users.role === "admin" */
  isAdmin: boolean;
  /** Has a linked row in `investors` (investors.user_id === user id). */
  isInvestor: boolean;
  onboardingCompleted: boolean;
};

/**
 * Landing route for a set of capabilities. The investor link wins over admin:
 * the owner (admin + investor) lands on /inicio and jumps to the panel from the
 * sidebar. An admin with no investments has nothing to show on /inicio, so they
 * land on the admin panel instead.
 */
export function homeRouteFor(capabilities: UserCapabilities): string {
  if (!capabilities.onboardingCompleted) return ONBOARDING_ROUTE;
  if (capabilities.isInvestor) return INVESTOR_HOME_ROUTE;
  if (capabilities.isAdmin) return ADMIN_HOME_ROUTE;
  return CATALOG_ROUTE;
}
