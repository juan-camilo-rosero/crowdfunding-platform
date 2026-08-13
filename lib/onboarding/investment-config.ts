/**
 * Which parts of the investment onboarding are switched on.
 *
 * integrations.md is explicit that Truora is a paid module and can be skipped
 * by configuration if the team has not activated it. The same courtesy is
 * extended to the signature, because a contract flow with no vendor behind it
 * is worse than no flow at all.
 *
 * Environment (all default to ON, so a deployment that sets nothing gets the
 * complete flow):
 *   INVESTMENT_ONBOARDING_ENABLED   "false" turns the WHOLE flow off
 *   IDENTITY_VERIFICATION_ENABLED   "false" skips the identity step
 *   CONTRACT_SIGNING_ENABLED        "false" skips the contract step
 *
 * A SKIPPED STEP COUNTS AS DONE. That is the useful reading: the platform is
 * not waiting on it, so it must not hold the investor in an unfinishable flow
 * or keep a banner on their home screen forever. With both steps off the flow
 * has nothing to ask for and switches itself off entirely.
 *
 * Read on the server only. These are not NEXT_PUBLIC_ variables: what the UI
 * shows is decided by the server and handed down as props.
 */

/** Absent or anything other than "false" means on. */
function isOn(value: string | undefined): boolean {
  return value?.trim().toLowerCase() !== "false";
}

export type InvestmentOnboardingConfig = {
  enabled: boolean;
  identityStepEnabled: boolean;
  contractStepEnabled: boolean;
  /**
   * Whether the investor may start their own signature from the stepper.
   *
   * True in mock mode, where there is no envelope to wait for and the point is
   * a demoable flow. FALSE with a real provider: the contract is a document the
   * team prepares for a specific investment, so the team sends it and the
   * investor signs what arrived. Derived from ESIGN_PROVIDER rather than being
   * its own flag — one source of truth for "is a real provider connected".
   */
  selfServiceSigning: boolean;
};

export function getInvestmentOnboardingConfig(): InvestmentOnboardingConfig {
  const identityStepEnabled = isOn(process.env.IDENTITY_VERIFICATION_ENABLED);
  const contractStepEnabled = isOn(process.env.CONTRACT_SIGNING_ENABLED);

  const provider = process.env.ESIGN_PROVIDER?.trim().toLowerCase();

  return {
    selfServiceSigning: provider !== "documenso",
    // With no step left to ask for, the flow is off however the master flag
    // reads — otherwise the stepper would render with nothing in it.
    enabled:
      isOn(process.env.INVESTMENT_ONBOARDING_ENABLED) &&
      (identityStepEnabled || contractStepEnabled),
    identityStepEnabled,
    contractStepEnabled,
  };
}
