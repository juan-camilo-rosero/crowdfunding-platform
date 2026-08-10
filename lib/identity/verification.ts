import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIdentityProvider } from "./provider";
import type { VerificationOutcome, VerificationStatus } from "./types";

/**
 * THE ONLY PLACE A USER BECOMES IDENTITY-VERIFIED.
 *
 * ─── Why this uses the service role ─────────────────────────────────────────
 *
 * `users.identity_verified` is deliberately NOT writable by an authenticated
 * session: migration 20260806172657 grants `authenticated` update on a fixed
 * column list, and that column is not on it. `identity_verifications` has a
 * select-own policy and no insert policy at all. So a user cannot mark
 * themselves verified even with a hand-rolled request — the database refuses,
 * not just the UI.
 *
 * That is the correct design, and it means the write has to come from a trusted
 * server path. This is exactly what lib/supabase/admin.ts exists for; its own
 * docblock names "Truora/e-sign webhooks" as the use case. NO RLS POLICY WAS
 * ADDED OR RELAXED for this feature, and none should be: a policy letting a
 * user write their own verification row would hand them self-approval, the same
 * class of escalation as the users.role hole fixed earlier.
 *
 * ─── The rule that keeps it safe ────────────────────────────────────────────
 *
 * `userId` MUST come from the verified session (or, later, from a signature-
 * checked Truora webhook). It is a parameter rather than something read here so
 * this module never guesses at identity — and every caller is a server action
 * that derives it from getVerifiedUser(). Nothing the browser sends reaches it,
 * and the outcome itself is produced by the provider, never by the request.
 */

export type VerificationRecord = {
  status: VerificationStatus;
  declineReason: string | null;
};

export type VerificationResult =
  | { ok: true; record: VerificationRecord }
  | { ok: false; reason: string };

/**
 * Writes the provider's decision.
 *
 * Shared by the mock (which resolves inline) and by the future Truora webhook,
 * so there is one state transition rather than two that can drift apart.
 *
 * A retry after a rejection adds a NEW row instead of editing the old one: the
 * table is the audit trail of what the provider said and when, and overwriting
 * it would erase the fact that a rejection happened.
 */
export async function recordVerificationOutcome(input: {
  userId: string;
  processId: string;
  outcome: VerificationOutcome;
}): Promise<VerificationResult> {
  const { userId, processId, outcome } = input;
  const declineReason = "declineReason" in outcome ? outcome.declineReason : null;

  try {
    const admin = createAdminClient();

    const { error: insertError } = await admin.from("identity_verifications").insert({
      user_id: userId,
      truora_process_id: processId,
      status: outcome.status,
      decline_reason: declineReason,
      completed_at: new Date().toISOString(),
    });

    if (insertError) {
      return { ok: false, reason: insertError.message };
    }

    // Only an approval moves the flag, and only ever to true from here.
    if (outcome.status === "aprobado") {
      const { error: updateError } = await admin
        .from("users")
        .update({ identity_verified: true, updated_at: new Date().toISOString() })
        .eq("id", userId);

      if (updateError) {
        return { ok: false, reason: updateError.message };
      }
    }

    return { ok: true, record: { status: outcome.status, declineReason } };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "unknown error",
    };
  }
}

export type VerificationAttempt =
  | { ok: true; kind: "resolved"; record: VerificationRecord }
  /** A real provider took over; the answer arrives by webhook. */
  | { ok: true; kind: "pending"; redirectUrl: string }
  | { ok: false; reason: string };

/**
 * Runs one verification attempt for the given user.
 *
 * The provider decides; this only persists what it decided. With the mock that
 * is immediate; with Truora it will be a redirect and a later webhook — and the
 * webhook lands on `recordVerificationOutcome` above, the same function.
 */
export async function startIdentityVerification(
  userId: string
): Promise<VerificationAttempt> {
  const provider = getIdentityProvider();
  const started = await provider.startVerification(userId);

  if (started.status === "failed") {
    console.error(`[identity:${provider.name}] failed — ${started.reason}`);
    return { ok: false, reason: started.reason };
  }

  if (started.status === "pending") {
    // Record the attempt so an abandoned flow is visible to an admin.
    await recordStartedAttempt(userId, started.processId);
    return { ok: true, kind: "pending", redirectUrl: started.redirectUrl };
  }

  const result = await recordVerificationOutcome({
    userId,
    processId: started.processId,
    outcome: started.outcome,
  });

  if (!result.ok) {
    console.error(`[identity:${provider.name}] could not persist — ${result.reason}`);
    return { ok: false, reason: result.reason };
  }

  return { ok: true, kind: "resolved", record: result.record };
}

/** An attempt that left for the provider and has not come back. */
async function recordStartedAttempt(userId: string, processId: string) {
  try {
    const admin = createAdminClient();
    await admin.from("identity_verifications").insert({
      user_id: userId,
      truora_process_id: processId,
      status: "iniciado" satisfies VerificationStatus,
    });
  } catch (error) {
    // Losing the breadcrumb must not stop the user from verifying.
    console.error(
      `[identity] could not record the started attempt — ${
        error instanceof Error ? error.message : "unknown error"
      }`
    );
  }
}
