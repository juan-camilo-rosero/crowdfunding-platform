"use server";

import { revalidatePath } from "next/cache";
import { es } from "@/i18n";
import { formatCurrency } from "@/lib/format";
import { REQUESTS_ROUTE } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import {
  getAvailableForProject,
  getReassignmentDestinations,
  type AvailabilityClient,
} from "@/lib/requests/availability";
import {
  exceedsAvailable,
  validateCreateRequest,
} from "@/lib/requests/create-schema";
import type { CreateRequestResult } from "@/lib/requests/create-types";

/**
 * Creates a reassignment request, always in state 'pendiente'.
 *
 * WHAT THIS DOES NOT DO: it does not move money, and it writes NOTHING to
 * `transactions`. Only an APPROVED request produces the `reasignación`
 * transaction, and approval is the admin flow. This records the ask.
 *
 * Four things make it safe regardless of what the browser sends:
 *
 *  1. `investor_id` is DERIVED from auth.uid() on the server. The payload has
 *     no such field, so there is nothing for a forged request to set.
 *  2. The insert runs on the SESSION-BOUND client, so RLS
 *     ("requests_insert_own") verifies the investor_id belongs to the caller.
 *     SUPABASE_SERVICE_ROLE_KEY is deliberately absent from this file — it
 *     bypasses RLS and would remove exactly that barrier.
 *  3. The amount ceiling is re-read from the database here. Whatever maximum
 *     the form believed is irrelevant; this number is the one enforced.
 *  4. `status` is set to 'pendiente' by this code, not by the payload, so a
 *     request cannot be born approved. resolved_at / resolved_by are never
 *     written.
 */
export async function createReassignmentRequest(
  input: unknown
): Promise<CreateRequestResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: es.requests.errors.notInvestor };
  }

  // 1. Identity → investor rows. Never from the client.
  const { data: investorRows } = await supabase
    .from("investors")
    .select("id")
    .eq("user_id", user.id);

  const investorIds = (investorRows ?? []).map((row) => row.id);
  if (investorIds.length === 0) {
    return { ok: false, error: es.requests.errors.notInvestor };
  }

  // 2. Shape and local rules (from ≠ to, amount > 0, uuids).
  const parsed = validateCreateRequest(input);
  if (!parsed.success) {
    const first =
      parsed.errors.fromProjectId ??
      parsed.errors.toProjectId ??
      parsed.errors.amount ??
      es.requests.errors.saveFailed;
    return { ok: false, error: first };
  }

  const { fromProjectId, toProjectId, amount } = parsed.data;
  const client = supabase as unknown as AvailabilityClient;

  // 3. Re-check everything against live data.
  const available = await getAvailableForProject(
    client,
    investorIds,
    fromProjectId
  );

  if (available === null) {
    return { ok: false, error: es.requests.errors.saveFailed };
  }

  // A source the investor holds no available capital in is not a valid source,
  // which also covers "this project isn't mine at all".
  if (available <= 0) {
    return { ok: false, error: es.requests.errors.invalidSource };
  }

  if (exceedsAvailable(amount, available)) {
    return {
      ok: false,
      error: es.requests.errors.amountTooHigh.replace(
        "{amount}",
        formatCurrency(available)
      ),
    };
  }

  // The destination must still be one that can receive capital.
  const { destinations, failed } = await getReassignmentDestinations(client);
  if (failed) {
    return { ok: false, error: es.requests.errors.saveFailed };
  }
  if (!destinations.some((d) => d.projectId === toProjectId)) {
    return { ok: false, error: es.requests.errors.invalidDestination };
  }

  // 4. Insert on the session-bound client: RLS checks ownership of investor_id.
  const { error } = await supabase.from("reassignment_requests").insert({
    investor_id: investorIds[0],
    from_project_id: fromProjectId,
    to_project_id: toProjectId,
    amount,
    // 5. Forced here; `status` has no default and must never come from input.
    status: "pendiente",
    // requested_at is filled by the column default. resolved_at / resolved_by
    // belong to the approval flow and are left untouched.
  });

  if (error) {
    return { ok: false, error: es.requests.errors.saveFailed };
  }

  // 6. The reading table picks the new row up on the next render.
  revalidatePath(REQUESTS_ROUTE);

  return { ok: true };
}
