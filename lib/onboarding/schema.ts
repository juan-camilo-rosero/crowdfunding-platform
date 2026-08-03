import { z } from "zod";
import { es } from "@/i18n";

/**
 * Validation for the basic onboarding form.
 *
 * ONE schema, imported by both halves: the client runs it on blur and on submit
 * for instant feedback, the Server Action runs it again before writing. The
 * server pass is the source of truth — the client one is a convenience that a
 * forged request simply skips.
 */

/** Digits only, everywhere. Commas, dots, spaces and dashes are rejected. */
const DIGITS = /^\d+$/;

/**
 * Letters, spaces, apostrophes and hyphens. Accented characters and ñ are in,
 * digits are out. \p{L} covers every alphabet, so a name is never rejected for
 * not being Latin.
 */
const NAME = /^[\p{L}][\p{L}\s'’-]*$/u;

export const onboardingSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, es.onboarding.errors.fullNameShort)
    .max(120, es.onboarding.errors.fullNameLong)
    .regex(NAME, es.onboarding.errors.fullNameFormat),

  documentId: z
    .string()
    .trim()
    .regex(DIGITS, es.onboarding.errors.documentFormat)
    .min(6, es.onboarding.errors.documentLength)
    .max(12, es.onboarding.errors.documentLength),

  /** Dial code including the "+", e.g. "+57". Comes from the country picker. */
  phoneCountryCode: z
    .string()
    .trim()
    .regex(/^\+\d{1,4}$/, es.onboarding.errors.phoneCountry),

  /** National number, digits only — the dial code travels separately. */
  phoneNumber: z
    .string()
    .trim()
    .regex(DIGITS, es.onboarding.errors.phoneFormat)
    .min(6, es.onboarding.errors.phoneLength)
    .max(15, es.onboarding.errors.phoneLength),

  city: z.string().trim().min(1, es.onboarding.errors.cityRequired),

  /**
   * Proof the city was PICKED from the autocomplete rather than typed. Without
   * it the value is free text, which is exactly what the field must not accept.
   */
  cityPlaceId: z.string().trim().min(1, es.onboarding.errors.citySelect),

  country: z.string().trim().optional().or(z.literal("")),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

/** Field-keyed error messages, the shape the form renders. */
export type OnboardingErrors = Partial<Record<keyof OnboardingInput, string>>;

/**
 * Runs the schema and flattens the issues to one message per field — the form
 * shows a single line under each input, not a list.
 */
export function validateOnboarding(
  input: Record<string, unknown>
): { success: true; data: OnboardingInput } | { success: false; errors: OnboardingErrors } {
  const result = onboardingSchema.safeParse(input);
  if (result.success) return { success: true, data: result.data };

  const errors: OnboardingErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof OnboardingInput | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return { success: false, errors };
}

/**
 * Builds the E.164 value stored in users.phone: dial code + national number,
 * with every non-digit stripped from the number first.
 */
export function toE164(countryCode: string, nationalNumber: string): string {
  return `${countryCode}${nationalNumber.replace(/\D/g, "")}`;
}
