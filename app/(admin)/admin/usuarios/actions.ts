"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { es } from "@/i18n";
import { createClient } from "@/lib/supabase/server";
import {
  NEW_INVESTOR_PIPELINE_STAGE,
  NEW_INVESTOR_STATUS,
  normalizeEmail,
  type ConvertResult,
} from "@/lib/users/convertible";

const ADMIN_USERS_ROUTE = "/admin/usuarios";

const inputSchema = z.object({ userId: z.uuid() });

/**
 * Turns a registered visitor into an investor, by creating or connecting their
 * row in `investors`.
 *
 * WHAT CONVERTING IS: a relationship, and nothing else.
 *   · users.role is NEVER touched — it stays 'visitante', which is correct:
 *     role measures the administrative level, and being an investor is derived
 *     from the link (user-management.md).
 *   · users.status is NEVER touched here either.
 *   · No capital, no contribution, no transaction is written. Converting says
 *     nothing about anyone having invested.
 *
 * AUTHORISATION is enforced twice, and neither relies on the client:
 *   · this function reads the caller's own profile and refuses a non-admin;
 *   · every write runs on the SESSION-BOUND client, so investors_admin_write
 *     re-checks public.is_admin() inside the database.
 * SUPABASE_SERVICE_ROLE_KEY is deliberately absent from this file: it would
 * bypass RLS and remove the second barrier.
 */
export async function convertVisitorToInvestor(
  input: unknown
): Promise<ConvertResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: es.adminUsers.errors.notFound };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: es.adminUsers.errors.notAdmin };
  }

  // 1. The caller must be an admin. Read from their own row, server side.
  const { data: caller } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (caller?.role !== "admin") {
    return { ok: false, error: es.adminUsers.errors.notAdmin };
  }

  // 2. The target must actually be convertible.
  const { data: target } = await supabase
    .from("users")
    .select("id, full_name, email, phone, role, onboarding_completed")
    .eq("id", parsed.data.userId)
    .maybeSingle();

  if (!target) {
    return { ok: false, error: es.adminUsers.errors.notFound };
  }
  if (target.role === "admin") {
    return { ok: false, error: es.adminUsers.errors.isAdmin };
  }
  if (!target.onboarding_completed) {
    return { ok: false, error: es.adminUsers.errors.onboardingPending };
  }

  // Already linked: a second row would be a duplicate identity, and every
  // scoped query in the app would then see two investors for one person.
  const { data: existingLink } = await supabase
    .from("investors")
    .select("id")
    .eq("user_id", target.id)
    .limit(1);

  if (existingLink && existingLink.length > 0) {
    return { ok: false, error: es.adminUsers.errors.alreadyInvestor };
  }

  // 3. Connect or create. The golden rule of user-management.md: the link is
  // made by verified email, so an admin who invited this person first
  // (Camino A) gets their prospect record connected rather than duplicated.
  const email = normalizeEmail(target.email);

  const { data: unlinked } = await supabase
    .from("investors")
    .select("id, email, user_id")
    .is("user_id", null);

  const match = (unlinked ?? []).find(
    (row) => normalizeEmail(row.email) === email
  );

  if (match) {
    const { error } = await supabase
      .from("investors")
      .update({ user_id: target.id, updated_at: new Date().toISOString() })
      .eq("id", match.id)
      // Guards against a race: if somebody linked this record in between, the
      // update matches nothing rather than stealing it.
      .is("user_id", null);

    if (error) {
      return { ok: false, error: es.adminUsers.errors.failed };
    }

    revalidatePath(ADMIN_USERS_ROUTE);
    return { ok: true, outcome: "connected" };
  }

  const { error } = await supabase.from("investors").insert({
    user_id: target.id,
    // Seeded from the profile the person filled in at onboarding. investors
    // .full_name is NOT NULL while users.full_name is not, so the email stands
    // in on the rare row where onboarding left it empty — a record that
    // identifies the person is better than a blocked conversion, and the admin
    // can correct the name afterwards.
    full_name: target.full_name?.trim() || target.email,
    email: target.email,
    phone: target.phone,
    status: NEW_INVESTOR_STATUS,
    pipeline_stage: NEW_INVESTOR_PIPELINE_STAGE,
  });

  if (error) {
    return { ok: false, error: es.adminUsers.errors.failed };
  }

  revalidatePath(ADMIN_USERS_ROUTE);
  return { ok: true, outcome: "created" };
}
