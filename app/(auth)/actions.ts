"use server";

import { redirect } from "next/navigation";
import { es } from "@/i18n";
import { homeRouteFor } from "@/lib/auth/routes";
import { validateCredentials, type AuthMode } from "@/lib/auth/credentials-schema";
import { createClient } from "@/lib/supabase/server";
import { isRole } from "@/types/user";

export type AuthResult = { ok: false; error: string };

/**
 * Email/password authentication.
 *
 * On success neither function returns: it redirects, so the caller cannot
 * forget to. A failure comes back as a message the form renders.
 *
 * SUPABASE_SERVICE_ROLE_KEY is absent from this file. Everything runs on the
 * session-bound server client, which is also what writes the auth cookies.
 */

/**
 * Maps a Supabase auth error to something a person can read — WITHOUT
 * confirming whether an address has an account here.
 *
 * That is the whole point of the generic branch: "correo o contraseña
 * incorrectos" answers a wrong password and an unknown address identically, so
 * the form cannot be used to enumerate who is a client of Investors 180.
 */
function messageForSignIn(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return es.auth.errors.rateLimited;
  }
  // Everything else — bad password, unknown user, unconfirmed — collapses here.
  return es.auth.errors.invalidCredentials;
}

function messageForSignUp(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("already registered") ||
    lower.includes("already exists") ||
    lower.includes("user already")
  ) {
    return es.auth.errors.alreadyRegistered;
  }
  if (lower.includes("password")) return es.auth.errors.weakPassword;
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return es.auth.errors.rateLimited;
  }
  return es.auth.errors.unexpected;
}

/**
 * Where to send someone who just authenticated.
 *
 * Reads the capability model and defers to homeRouteFor — the single source of
 * truth shared with proxy.ts and the OAuth callback. A brand-new account has
 * onboarding_completed = false, so that helper sends it to /onboarding without
 * this code needing to know.
 */
async function redirectAfterAuth(userId: string): Promise<never> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("users")
    .select("role, onboarding_completed")
    .eq("id", userId)
    .single();

  const { data: investorLink } = await supabase
    .from("investors")
    .select("id")
    .eq("user_id", userId)
    .limit(1);

  redirect(
    homeRouteFor({
      isAdmin: !!profile && isRole(profile.role) && profile.role === "admin",
      isInvestor: !!investorLink && investorLink.length > 0,
      onboardingCompleted: profile?.onboarding_completed ?? false,
    })
  );
}

async function authenticate(
  mode: AuthMode,
  input: unknown
): Promise<AuthResult> {
  const parsed = validateCredentials(mode, input);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.errors.email ??
        parsed.errors.password ??
        es.auth.errors.unexpected,
    };
  }

  const supabase = await createClient();
  const { email, password } = parsed.data;

  const { data, error } =
    mode === "signup"
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      ok: false,
      error:
        mode === "signup"
          ? messageForSignUp(error.message)
          : messageForSignIn(error.message),
    };
  }

  // "Confirm email" is off for this project, so a sign-up returns a live
  // session. If it were ever switched on, `session` would be null here and the
  // generic message is the safe answer rather than a false success.
  if (!data.user || !data.session) {
    return { ok: false, error: es.auth.errors.unexpected };
  }

  await redirectAfterAuth(data.user.id);
  return { ok: false, error: es.auth.errors.unexpected };
}

export async function signUpWithPassword(input: unknown): Promise<AuthResult> {
  return authenticate("signup", input);
}

export async function signInWithPassword(input: unknown): Promise<AuthResult> {
  return authenticate("login", input);
}
