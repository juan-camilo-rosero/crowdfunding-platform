"use server";

import { redirect } from "next/navigation";
import { es } from "@/i18n";
import { LOGIN_ROUTE, homeRouteFor } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import { isRole } from "@/types/user";

export type CompleteOnboardingState = { error: string | null };

/**
 * TEMPORARY (Sprint 1): flips `onboarding_completed` to true without capturing
 * any data.
 *
 * Replace with the real personal-data form (full name, E.164 phone,
 * city/country) validated with Zod, per views.md. It exists only so the auth
 * flow can be walked end to end in the meantime.
 *
 * The write is constrained by RLS (`users_update_own`: auth.uid() = id), so a
 * user cannot complete somebody else's onboarding even by forging the request.
 */
export async function completeBasicOnboarding(
  _prevState: CompleteOnboardingState,
  _formData: FormData
): Promise<CompleteOnboardingState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`${LOGIN_ROUTE}?error=session-required`);
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !isRole(profile.role)) {
    return { error: es.onboarding.saveError };
  }

  const { error } = await supabase
    .from("users")
    .update({
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return { error: es.onboarding.saveError };
  }

  // The role does NOT change here: promoting to investor is the admin's call
  // when linking the person to a project (user-management.md).
  redirect(homeRouteFor(profile.role));
}
