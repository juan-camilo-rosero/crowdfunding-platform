import { z } from "zod";
import { es } from "@/i18n";
import { INVESTMENT_TYPE_PREFS, type CreateInterestInput } from "./types";

/**
 * Shape and local rules for a new investment interest.
 *
 * ONE schema for both halves: the card runs it for instant feedback, the Server
 * Action runs it again before writing. The server pass is the authority.
 *
 * There is no `phone` rule: the form does not ask for one. The onboarding
 * already stored it, and the action attaches that stored value.
 */
export const interestSchema = z.object({
  projectId: z.uuid(es.projectDetail.interest.errors.projectRequired),

  // Optional on purpose: someone may be interested before having a figure.
  amount: z
    .number({ error: es.projectDetail.interest.errors.amountNumber })
    .finite(es.projectDetail.interest.errors.amountNumber)
    .positive(es.projectDetail.interest.errors.amountPositive)
    .nullish(),

  investmentTypePref: z.enum(INVESTMENT_TYPE_PREFS, {
    error: es.projectDetail.interest.errors.typeRequired,
  }),

  comments: z.string().trim().max(2000).nullish(),
});

export type InterestErrors = Partial<Record<keyof CreateInterestInput, string>>;

/** Runs the schema and flattens the issues to one message per field. */
export function validateInterest(
  input: unknown
):
  | { success: true; data: CreateInterestInput }
  | { success: false; errors: InterestErrors } {
  const result = interestSchema.safeParse(input);
  if (result.success) return { success: true, data: result.data as CreateInterestInput };

  const errors: InterestErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof CreateInterestInput | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return { success: false, errors };
}
