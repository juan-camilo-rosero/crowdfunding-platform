import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isRole, isUserStatus, type Role, type UserProfile } from "@/types/user";

/** Usuario autenticado según Supabase Auth, o null. Memoizado por request. */
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
 * Fila de public.users del usuario autenticado. RLS ya restringe a la propia
 * fila (o admin); se filtra también por id de forma explícita como segunda barrera.
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
