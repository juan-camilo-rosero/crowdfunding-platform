import { CONTRACT_DOC_TYPE } from "@/lib/esign/contract";
import {
  getInvestmentOnboardingConfig,
  type InvestmentOnboardingConfig,
} from "./investment-config";

/**
 * Where an investor stands in the investment onboarding.
 *
 * DERIVED, NOT STORED. No column and no table was added for this:
 *
 *   identity → users.identity_verified, which only lib/identity/verification.ts
 *              can set (the column is not even grantable to `authenticated`).
 *   contract → a `contrato` document exists for their investor row.
 *
 * Deriving it means the progress can never disagree with the facts. A stored
 * "step 2 of 2" flag is one failed write away from claiming somebody signed a
 * contract that is not there.
 *
 * WHEN THE REAL PROVIDERS ARRIVE this will want revisiting for the contract
 * half: a Documenso envelope has states this cannot see — sent, viewed,
 * declined, expired — and "no document yet" cannot tell them apart. The natural
 * shape is a signature-tracking table mirroring identity_verifications
 * (envelope id, status, decline reason, completed_at), and the derivation would
 * then read it instead of inferring from absence. Not built now because a mock
 * that resolves immediately has no intermediate state to track, and a table
 * with one always-terminal row would be scaffolding pretending to be a feature.
 */

export type StepState = "pendiente" | "hecho" | "omitido";

export type InvestmentOnboardingState = {
  /** False when the flow is switched off, or the person is not an investor. */
  applies: boolean;
  identity: StepState;
  contract: StepState;
  /** Every step that applies is done. */
  isComplete: boolean;
  config: InvestmentOnboardingConfig;
};

/** Nothing to do: not an investor, or the flow is off. */
export const NOT_APPLICABLE: InvestmentOnboardingState = {
  applies: false,
  identity: "omitido",
  contract: "omitido",
  isComplete: true,
  config: {
    enabled: false,
    identityStepEnabled: false,
    contractStepEnabled: false,
  },
};

export type InvestmentOnboardingFacts = {
  /** Has an investor link. Eligibility starts here — see user-management.md. */
  isInvestor: boolean;
  /** users.identity_verified. */
  identityVerified: boolean;
  /** A `contrato` document exists for this investor. */
  hasSignedContract: boolean;
};

/**
 * Turns the facts into the state the screens read.
 *
 * Pure, so the rule can be tested without a database. `deriveState` never asks
 * who the caller is: the facts arrive already scoped to one investor by the
 * server (see getInvestmentOnboardingState below).
 */
export function deriveInvestmentOnboardingState(
  facts: InvestmentOnboardingFacts,
  config: InvestmentOnboardingConfig = getInvestmentOnboardingConfig()
): InvestmentOnboardingState {
  // Only a linked investor is in this flow. Nobody self-enrols: the link is the
  // admin's act (user-management.md), and it is what triggers this.
  if (!facts.isInvestor || !config.enabled) {
    return { ...NOT_APPLICABLE, config };
  }

  const identity: StepState = !config.identityStepEnabled
    ? "omitido"
    : facts.identityVerified
      ? "hecho"
      : "pendiente";

  const contract: StepState = !config.contractStepEnabled
    ? "omitido"
    : facts.hasSignedContract
      ? "hecho"
      : "pendiente";

  return {
    applies: true,
    identity,
    contract,
    isComplete: identity !== "pendiente" && contract !== "pendiente",
    config,
  };
}

/** Minimal shape of the Supabase client this module needs. Keeps it mockable. */
type QueryBuilder = {
  select: (columns: string) => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  in: (column: string, values: unknown[]) => QueryBuilder;
  limit: (count: number) => QueryBuilder;
  then: Promise<{ data: unknown[] | null; error: unknown }>["then"];
};

export type OnboardingClient = { from: (table: string) => QueryBuilder };

/**
 * Reads the facts for ONE investor and derives the state.
 *
 * `userId` and `investorIds` come from the session. Both reads run under the
 * caller's own session, so RLS filters them a second time: users_select_own
 * restricts the flag to their row, and documents_select to their documents.
 */
export async function fetchInvestmentOnboardingState(
  client: OnboardingClient,
  userId: string,
  investorIds: string[],
  config: InvestmentOnboardingConfig = getInvestmentOnboardingConfig()
): Promise<InvestmentOnboardingState> {
  if (investorIds.length === 0 || !config.enabled) {
    return { ...NOT_APPLICABLE, config };
  }

  const [profile, contract] = await Promise.all([
    client.from("users").select("identity_verified").eq("id", userId).limit(1),
    client
      .from("documents")
      .select("id")
      .eq("doc_type", CONTRACT_DOC_TYPE)
      .in("investor_id", investorIds)
      .limit(1),
  ]);

  const identityVerified = !!(
    (profile.data ?? []) as { identity_verified: boolean | null }[]
  )[0]?.identity_verified;

  return deriveInvestmentOnboardingState(
    {
      isInvestor: true,
      identityVerified,
      hasSignedContract: ((contract.data ?? []) as unknown[]).length > 0,
    },
    config
  );
}
