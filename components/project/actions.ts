"use server";

import { es } from "@/i18n";
import { createClient } from "@/lib/supabase/server";
import { validateInterest } from "@/lib/interests/schema";
import type { CreateInterestResult } from "@/lib/interests/types";
import {
  confirmInterestToUser,
  notifyTeamOfInterest,
} from "@/lib/interests/notify";

/**
 * Records an investment interest, always in state 'nuevo'.
 *
 * THE SAVED ROW IS THE SOURCE OF TRUTH. Once the insert succeeds the user is
 * told so, and the email that follows is fired best-effort: it runs inside a
 * try/catch, its helpers swallow their own failures, and nothing it returns can
 * change the outcome. An unconfigured mail provider is a normal state of this
 * system, not a degraded one.
 *
 * Safety, same shape as the reassignment action:
 *  · `user_id` is derived from auth.uid() here; the payload has no such field.
 *  · The insert runs on the SESSION-BOUND client, so interests_insert_own
 *    verifies ownership. SUPABASE_SERVICE_ROLE_KEY is absent from this file.
 *  · `status` is set to 'nuevo' by this code, never taken from input — and
 *    since migration 20260806215537 the policy refuses anything else anyway.
 */
export async function createInvestmentInterest(
  input: unknown
): Promise<CreateInterestResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: es.projectDetail.interest.errors.notSignedIn };
  }

  // The phone is never asked for again: the onboarding stored it, and the
  // action attaches whatever is on the profile.
  const { data: profile } = await supabase
    .from("users")
    .select("full_name, email, phone")
    .eq("id", user.id)
    .single();

  const profilePhone = profile?.phone?.trim() || null;

  const parsed = validateInterest(input);
  if (!parsed.success) {
    const first =
      parsed.errors.investmentTypePref ??
      parsed.errors.amount ??
      parsed.errors.projectId ??
      es.projectDetail.interest.errors.saveFailed;
    return { ok: false, error: first };
  }

  const { projectId, amount, investmentTypePref, comments } = parsed.data;

  const { error } = await supabase.from("investment_interests").insert({
    user_id: user.id,
    project_id: projectId,
    amount: amount ?? null,
    investment_type_pref: investmentTypePref,
    comments: comments?.trim() || null,
    // Straight from the profile, so the team always has a way to call.
    phone: profilePhone,
    // Forced here; a status in the payload is ignored.
    status: "nuevo",
  });

  if (error) {
    return { ok: false, error: es.projectDetail.interest.errors.saveFailed };
  }

  // ---- Everything below is best effort. The interest is already saved. ----
  try {
    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .maybeSingle();

    const notification = {
      projectName: project?.name ?? "",
      investorName: profile?.full_name ?? "",
      investorEmail: profile?.email ?? user.email ?? "",
      amount,
      investmentTypePref,
      comments,
      phone: profilePhone,
    };

    await notifyTeamOfInterest(notification);
    await confirmInterestToUser(notification);
  } catch (error) {
    // Deliberately swallowed: the row exists, so the user's confirmation is
    // accurate whatever happened here.
    console.error("[interest] notification step failed", error);
  }

  return { ok: true };
}
