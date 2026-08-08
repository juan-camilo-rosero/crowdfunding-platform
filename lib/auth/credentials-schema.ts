import { z } from "zod";
import { es } from "@/i18n";

/**
 * Credentials for the email/password screens.
 *
 * ONE schema per mode, shared by both halves: the form runs it for instant
 * feedback, the Server Action runs it again before calling Supabase.
 *
 * Sign-up and sign-in deliberately differ. Sign-up enforces the length policy,
 * because that is where a password is chosen. Sign-in only requires something
 * to be typed: rejecting a short password at login would tell an attacker their
 * guess was too short to be this account's, and it would lock out anyone whose
 * password predates the policy.
 */

/** Supabase's default minimum. Keep in step with the project's Auth settings. */
export const MIN_PASSWORD_LENGTH = 8;

export const signUpSchema = z.object({
  email: z.email(es.auth.errors.emailInvalid),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, es.auth.errors.passwordShort),
});

export const signInSchema = z.object({
  email: z.email(es.auth.errors.emailInvalid),
  password: z.string().min(1, es.auth.errors.passwordRequired),
});

/** First step of sign-up: the address alone, before a password is asked for. */
export const emailSchema = z.email(es.auth.errors.emailInvalid);

export type Credentials = z.infer<typeof signUpSchema>;
export type CredentialErrors = Partial<Record<keyof Credentials, string>>;

export type AuthMode = "login" | "signup";

export function schemaFor(mode: AuthMode) {
  return mode === "signup" ? signUpSchema : signInSchema;
}

/** Runs the schema and flattens the issues to one message per field. */
export function validateCredentials(
  mode: AuthMode,
  input: unknown
):
  | { success: true; data: Credentials }
  | { success: false; errors: CredentialErrors } {
  const result = schemaFor(mode).safeParse(input);
  if (result.success) return { success: true, data: result.data };

  const errors: CredentialErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof Credentials | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return { success: false, errors };
}
