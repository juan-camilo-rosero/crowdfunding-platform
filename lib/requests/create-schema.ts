import { z } from "zod";
import { es } from "@/i18n";
import type { CreateReassignmentRequestInput } from "./create-types";

/**
 * Shape and local rules of a new reassignment request.
 *
 * ONE schema, run by both halves: the form runs it for instant feedback, the
 * Server Action runs it again before writing.
 *
 * What it deliberately does NOT cover is `amount <= available`. That ceiling
 * depends on live data, so checking it against a number the client supplied
 * would be checking the client's homework against the client's answer key. The
 * action re-reads the real availability and enforces it there (see
 * lib/requests/availability.ts).
 */
export const createRequestSchema = z
  .object({
    fromProjectId: z.uuid(es.requests.errors.fromRequired),
    toProjectId: z.uuid(es.requests.errors.toRequired),
    amount: z
      .number({ error: es.requests.errors.amountNumber })
      .finite(es.requests.errors.amountNumber)
      .positive(es.requests.errors.amountPositive),
  })
  .refine((value) => value.fromProjectId !== value.toProjectId, {
    message: es.requests.errors.sameProject,
    path: ["toProjectId"],
  });

export type CreateRequestErrors = Partial<
  Record<keyof CreateReassignmentRequestInput, string>
>;

/** Runs the schema and flattens the issues to one message per field. */
export function validateCreateRequest(
  input: unknown
):
  | { success: true; data: CreateReassignmentRequestInput }
  | { success: false; errors: CreateRequestErrors } {
  const result = createRequestSchema.safeParse(input);
  if (result.success) return { success: true, data: result.data };

  const errors: CreateRequestErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as
      | keyof CreateReassignmentRequestInput
      | undefined;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return { success: false, errors };
}

/**
 * The ceiling check, kept next to the schema so both halves phrase it the same
 * way — but always fed the SERVER's number, never the client's.
 */
export function exceedsAvailable(amount: number, available: number): boolean {
  return amount > available;
}
