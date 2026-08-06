import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedUser, type VerifiedUser } from "@/lib/auth/claims";
import type { UserCapabilities } from "@/lib/auth/routes";
import { isRole, isUserStatus, type Role, type UserProfile } from "@/types/user";

/**
 * Authenticated user, or null. Memoized per request.
 *
 * Verifies the JWT signature locally rather than asking the Auth server, which
 * removes a ~170ms round trip from every render. proxy.ts has already refreshed
 * the session by the time this runs, so there is nothing to renew here — only
 * to verify. See lib/auth/claims.ts for why this is not `getSession()`.
 */
export const getCurrentUser = cache(async (): Promise<VerifiedUser | null> => {
  const supabase = await createClient();
  return getVerifiedUser(supabase);
});

/**
 * The investor rows linked to the current user.
 *
 * Memoized per request, and the ONE place that asks. The layout needs it to
 * decide the sidebar and most investor screens need the ids to scope their
 * queries; before this they each ran their own copy of the same query, paying
 * the round trip twice on every navigation.
 *
 * The explicit user_id filter matters: RLS lets an admin read every investors
 * row, so without it an admin would look like an investor.
 */
export const getInvestorIds = cache(async (): Promise<string[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("investors")
    .select("id")
    .eq("user_id", user.id);

  if (error || !data) return [];
  return data.map((row) => row.id);
});

/**
 * The authenticated user's public.users row. RLS already restricts this to the
 * caller's own row (or admin); the explicit id filter is a second barrier.
 */
export const getCurrentUserProfile = cache(async (): Promise<UserProfile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !data) return null;
  if (!isRole(data.role) || !isUserStatus(data.status)) return null;

  return data as UserProfile;
});

/** Administrative level only. Being an investor is tracked separately. */
export async function isAdmin(): Promise<boolean> {
  const profile = await getCurrentUserProfile();
  return profile?.role === "admin";
}

/**
 * Investor capability, DERIVED from the link: true when a row in `investors`
 * points at this user. Never read from users.role.
 *
 * The explicit user_id filter matters: RLS lets an admin read every investors
 * row, so without it an admin would look like an investor.
 */
export const isInvestor = cache(async (): Promise<boolean> => {
  return (await getInvestorIds()).length > 0;
});

/** All capabilities at once, for sidebar rendering and landing decisions. */
export const getCapabilities = cache(async (): Promise<UserCapabilities | null> => {
  const profile = await getCurrentUserProfile();
  if (!profile) return null;

  return {
    isAdmin: profile.role === "admin",
    isInvestor: await isInvestor(),
    onboardingCompleted: profile.onboarding_completed,
  };
});

/** Administrative level. Kept for callers that need the raw value. */
export async function getUserRole(): Promise<Role | null> {
  const profile = await getCurrentUserProfile();
  return profile?.role ?? null;
}
