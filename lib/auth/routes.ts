import type { Role } from "@/types/user";

/**
 * Canonical destinations of the authentication flow. Single source of truth for
 * proxy.ts, app/page.tsx and the OAuth callback: duplicating this rule is how it
 * drifts out of sync (exactly what caused the visitor-stuck-on-/portafolio bug).
 *
 * See the role x onboarding_completed matrix in .claude/docs/user-management.md.
 */
export const LOGIN_ROUTE = "/login";
export const ONBOARDING_ROUTE = "/onboarding";
export const CATALOG_ROUTE = "/portafolio";
export const INVESTOR_HOME_ROUTE = "/inicio";

/** Destination after completing basic onboarding, by role. */
export function homeRouteFor(role: Role): string {
  return role === "visitante" ? CATALOG_ROUTE : INVESTOR_HOME_ROUTE;
}
