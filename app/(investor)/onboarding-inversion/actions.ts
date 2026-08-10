"use server";

import { revalidatePath } from "next/cache";
import { es } from "@/i18n";
import {
  DOCUMENTS_ROUTE,
  INVESTOR_HOME_ROUTE,
  INVESTMENT_ONBOARDING_ROUTE,
} from "@/lib/auth/routes";
import { getCurrentUser, getCurrentUserProfile, getInvestorIds } from "@/lib/auth/session";
import { requestContractSignature } from "@/lib/esign/contract";
import { startIdentityVerification } from "@/lib/identity/verification";
import { getInvestmentOnboardingConfig } from "@/lib/onboarding/investment-config";
import type { VerificationStatus } from "@/lib/identity/types";

/**
 * The two actions of the investment onboarding.
 *
 * NOTICE WHAT THEY TAKE: nothing. No arguments at all, by design.
 *
 * The client can only ASK for a verification or a signature; it cannot state a
 * result, an identity, or a status. Everything that decides the outcome lives
 * on this side: who the caller is comes from the verified session, whether they
 * are eligible comes from their investor link, whether the step is on comes
 * from the environment, and the outcome itself comes from the provider.
 *
 * The database backs this up rather than trusting it. `users.identity_verified`
 * is not in the column GRANT for `authenticated` (migration 20260806172657),
 * and `documents` only has an admin write policy — so even a request that
 * bypassed these actions entirely could not mark itself verified or file a
 * contract. NO POLICY WAS ADDED OR RELAXED for this feature.
 */

export type OnboardingActionResult =
  | { ok: true; status: "hecho" }
  /** The provider said no. The step stays pending and can be retried. */
  | { ok: true; status: "rechazado" | "expirado"; message: string }
  /** A real provider took over: send the user there. */
  | { ok: true; status: "pendiente"; redirectUrl: string }
  | { ok: false; error: string };

/** Identity + investor link, or the reason this caller is not in the flow. */
async function requireInvestor() {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: es.investmentOnboarding.errors.notInvestor };

  const investorIds = await getInvestorIds();
  // Nobody self-enrols. The link is the admin's act (user-management.md), and
  // it is the only way into this flow.
  if (investorIds.length === 0) {
    return { ok: false as const, error: es.investmentOnboarding.errors.notInvestor };
  }

  return { ok: true as const, userId: user.id, investorId: investorIds[0] };
}

const REJECTION_MESSAGE: Record<VerificationStatus, string> = {
  iniciado: es.investmentOnboarding.errors.identityFailed,
  aprobado: "",
  rechazado: es.investmentOnboarding.identity.rejected,
  expirado: es.investmentOnboarding.identity.expired,
};

/** Runs one identity verification for the CURRENT user. */
export async function verifyIdentity(): Promise<OnboardingActionResult> {
  const caller = await requireInvestor();
  if (!caller.ok) return { ok: false, error: caller.error };

  const config = getInvestmentOnboardingConfig();
  if (!config.enabled || !config.identityStepEnabled) {
    return { ok: false, error: es.investmentOnboarding.errors.disabled };
  }

  // The user id comes from the session, never from an argument.
  const attempt = await startIdentityVerification(caller.userId);

  if (!attempt.ok) {
    return { ok: false, error: es.investmentOnboarding.errors.identityFailed };
  }

  if (attempt.kind === "pending") {
    return { ok: true, status: "pendiente", redirectUrl: attempt.redirectUrl };
  }

  revalidatePath(INVESTMENT_ONBOARDING_ROUTE);
  revalidatePath(INVESTOR_HOME_ROUTE);

  if (attempt.record.status === "aprobado") {
    return { ok: true, status: "hecho" };
  }

  return {
    ok: true,
    status: attempt.record.status === "expirado" ? "expirado" : "rechazado",
    message: REJECTION_MESSAGE[attempt.record.status],
  };
}

/** Signs the investment contract for the CURRENT user. */
export async function signContract(): Promise<OnboardingActionResult> {
  const caller = await requireInvestor();
  if (!caller.ok) return { ok: false, error: caller.error };

  const config = getInvestmentOnboardingConfig();
  if (!config.enabled || !config.contractStepEnabled) {
    return { ok: false, error: es.investmentOnboarding.errors.disabled };
  }

  const profile = await getCurrentUserProfile();

  // Identity first when it applies: signing a contract as someone whose
  // identity was never checked is the case the verification exists to prevent.
  if (config.identityStepEnabled && !profile?.identity_verified) {
    return { ok: false, error: es.investmentOnboarding.contract.blocked };
  }

  const result = await requestContractSignature({
    userId: caller.userId,
    investorId: caller.investorId,
    documentName: es.investmentOnboarding.contract.previewTitle,
    signerEmail: profile?.email ?? null,
    signerName: profile?.full_name ?? null,
  });

  if (!result.ok) {
    return { ok: false, error: es.investmentOnboarding.errors.contractFailed };
  }

  if (result.kind === "pending") {
    return { ok: true, status: "pendiente", redirectUrl: result.signingUrl };
  }

  revalidatePath(INVESTMENT_ONBOARDING_ROUTE);
  revalidatePath(INVESTOR_HOME_ROUTE);
  // The contract shows up in the investor's existing documents screen.
  revalidatePath(DOCUMENTS_ROUTE);

  return { ok: true, status: "hecho" };
}
