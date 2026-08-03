"use server";

import { redirect } from "next/navigation";
import { es } from "@/i18n";
import { LOGIN_ROUTE, homeRouteFor } from "@/lib/auth/routes";
import {
  toE164,
  validateOnboarding,
  type OnboardingErrors,
} from "@/lib/onboarding/schema";
import { createClient } from "@/lib/supabase/server";
import { isRole } from "@/types/user";

/**
 * Only ASYNC FUNCTIONS may be exported from a "use server" module. A plain
 * constant here compiles, but the client receives `undefined` for it — which is
 * why the initial state lives in the form component. Types are erased, so
 * exporting one is fine.
 */
export type OnboardingState = {
  /** Message shown above the form when the save itself failed. */
  error: string | null;
  /** Per-field messages from the server-side schema run. */
  fieldErrors: OnboardingErrors;
};

/**
 * Saves the basic onboarding: personal data only.
 *
 * NO identity verification and NO contract here — those belong to the
 * investment onboarding, a later sprint (views.md, integrations.md).
 *
 * Two things make this safe regardless of what the client sends:
 *
 *  1. The row written is ALWAYS the caller's. The id comes from
 *     supabase.auth.getUser() — the session, verified server-side — never from
 *     the form. There is no field a request could set to target somebody else,
 *     and users_update_own (auth.uid() = id) would reject it anyway.
 *  2. The payload is re-validated with the SAME Zod schema the client uses. The
 *     client run is a convenience; this one is the source of truth, and a
 *     forged POST that skips the form meets it all the same.
 *
 * Completing this grants NO capability: not the investor link, not the admin
 * role (user-management.md). It only flips onboarding_completed.
 */
export async function saveBasicOnboarding(
  _prevState: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(LOGIN_ROUTE);
  }

  const parsed = validateOnboarding({
    fullName: formData.get("fullName")?.toString() ?? "",
    documentId: formData.get("documentId")?.toString() ?? "",
    phoneCountryCode: formData.get("phoneCountryCode")?.toString() ?? "",
    phoneNumber: formData.get("phoneNumber")?.toString() ?? "",
    city: formData.get("city")?.toString() ?? "",
    cityPlaceId: formData.get("cityPlaceId")?.toString() ?? "",
    country: formData.get("country")?.toString() ?? "",
  });

  if (!parsed.success) {
    return { error: null, fieldErrors: parsed.errors };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !isRole(profile.role)) {
    return { error: es.onboarding.saveError, fieldErrors: {} };
  }

  const { error } = await supabase
    .from("users")
    .update({
      full_name: parsed.data.fullName,
      document_id: parsed.data.documentId,
      // phone holds the canonical E.164 value (CLAUDE.md); the dial code is
      // stored alongside it so the form can restore the country selector.
      phone: toE164(parsed.data.phoneCountryCode, parsed.data.phoneNumber),
      phone_country_code: parsed.data.phoneCountryCode,
      city: parsed.data.city,
      country: parsed.data.country || null,
      city_place_id: parsed.data.cityPlaceId,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    })
    // Belt and braces: RLS already limits this to the caller's own row.
    .eq("id", user.id);

  if (error) {
    return { error: es.onboarding.saveError, fieldErrors: {} };
  }

  // Capabilities are only READ here, to pick the landing route.
  const { data: investorLink } = await supabase
    .from("investors")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  redirect(
    homeRouteFor({
      isAdmin: profile.role === "admin",
      isInvestor: !!investorLink && investorLink.length > 0,
      onboardingCompleted: true,
    })
  );
}
