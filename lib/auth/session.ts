import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
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

export async function getUserRole(): Promise<Role | null> {
  const profile = await getCurrentUserProfile();
  return profile?.role ?? null;
}

export async function isAdmin(): Promise<boolean> {
  return (await getUserRole()) === "admin";
}
