import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { UserCapabilities } from "@/lib/auth/routes";
import { isRole, isUserStatus, type Role, type UserProfile } from "@/types/user";

/** Authenticated user per Supabase Auth, or null. Memoized per request. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user;
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
  const user = await getCurrentUser();
  if (!user) return false;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("investors")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  if (error || !data) return false;
  return data.length > 0;
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
