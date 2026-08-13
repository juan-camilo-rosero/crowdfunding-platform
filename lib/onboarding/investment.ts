import { CONTRACT_DOC_TYPE } from "@/lib/esign/contract";
import type { SigningStatus } from "@/lib/esign/webhook-events";
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
 * The contract half now also reads `signing_requests` (added when Documenso was
 * connected), because "no document yet" cannot tell apart never-sent, waiting
 * for the signer, rejected and expired — states a real provider genuinely has.
 * The filed document still wins: it is the fact, and the tracking row is the
 * narrative of how it got there.
 */

export type StepState = "pendiente" | "hecho" | "omitido";

/**
 * Where the contract stands, in the detail a real provider makes possible.
 *
 * `procesando` is the honest answer to the moment right after somebody signs:
 * the provider has their signature, our webhook has not landed yet, and saying
 * either "pending" or "done" would be wrong.
 */
export type ContractStage =
  | "sin-enviar"
  | "en-firma"
  | "procesando"
  | "firmado"
  | "rechazado"
  | "anulado"
  | "expirado"
  | "omitido";

export type SigningSnapshot = {
  status: SigningStatus;
  /** Where the investor resumes signing. Absent unless the provider gave one. */
  signingUrl: string | null;
  declinedReason: string | null;
  hasSignedDocument: boolean;
};

/** Turns the tracking row plus the filed document into one stage. */
export function contractStage(
  hasSignedContract: boolean,
  signing: SigningSnapshot | null,
  stepEnabled: boolean,
  selfServiceSigning: boolean
): ContractStage {
  if (!stepEnabled) return "omitido";
  // The filed document is the fact; everything else describes the journey.
  if (hasSignedContract) return "firmado";
  // Nothing sent yet. In mock mode the investor signs inline, so there is
  // nothing to wait for; with a real provider they wait for the team.
  if (!signing) return selfServiceSigning ? "en-firma" : "sin-enviar";

  switch (signing.status) {
    case "completado":
      // Signed for real, but the PDF is not filed yet.
      return "procesando";
    case "rechazado":
      return "rechazado";
    case "anulado":
      return "anulado";
    case "expirado":
      return "expirado";
    default:
      return "en-firma";
  }
}

export type InvestmentOnboardingState = {
  /** False when the flow is switched off, or the person is not an investor. */
  applies: boolean;
  identity: StepState;
  contract: StepState;
  /** The detail behind `contract`, once a real provider is connected. */
  contractStage: ContractStage;
  signing: SigningSnapshot | null;
  /** Every step that applies is done. */
  isComplete: boolean;
  config: InvestmentOnboardingConfig;
};

/** Nothing to do: not an investor, or the flow is off. */
export const NOT_APPLICABLE: InvestmentOnboardingState = {
  applies: false,
  identity: "omitido",
  contract: "omitido",
  contractStage: "omitido",
  signing: null,
  isComplete: true,
  config: {
    enabled: false,
    identityStepEnabled: false,
    contractStepEnabled: false,
    selfServiceSigning: false,
  },
};

export type InvestmentOnboardingFacts = {
  /** Has an investor link. Eligibility starts here — see user-management.md. */
  isInvestor: boolean;
  /** users.identity_verified. */
  identityVerified: boolean;
  /** A `contrato` document exists for this investor. */
  hasSignedContract: boolean;
  /** The latest signing request, when one has been sent. */
  signing?: SigningSnapshot | null;
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

  const signing = facts.signing ?? null;

  return {
    applies: true,
    identity,
    contract,
    contractStage: contractStage(
      facts.hasSignedContract,
      signing,
      config.contractStepEnabled,
      config.selfServiceSigning
    ),
    signing,
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

  const [profile, contract, signing] = await Promise.all([
    client.from("users").select("identity_verified").eq("id", userId).limit(1),
    client
      .from("documents")
      .select("id")
      .eq("doc_type", CONTRACT_DOC_TYPE)
      .in("investor_id", investorIds)
      .limit(1),
    // The investor may READ their own signing requests (select-own policy);
    // only writing them is privileged.
    client
      .from("signing_requests")
      .select("status, declined_reason, signed_document_id")
      .in("investor_id", investorIds)
      .limit(1),
  ]);

  const signingRow = (
    (signing.data ?? []) as {
      status: string;
      declined_reason: string | null;
      signed_document_id: string | null;
    }[]
  )[0];

  const identityVerified = !!(
    (profile.data ?? []) as { identity_verified: boolean | null }[]
  )[0]?.identity_verified;

  return deriveInvestmentOnboardingState(
    {
      isInvestor: true,
      identityVerified,
      hasSignedContract: ((contract.data ?? []) as unknown[]).length > 0,
      signing: signingRow
        ? {
            status: signingRow.status as SigningStatus,
            signingUrl: null,
            declinedReason: signingRow.declined_reason,
            hasSignedDocument: !!signingRow.signed_document_id,
          }
        : null,
    },
    config
  );
}
