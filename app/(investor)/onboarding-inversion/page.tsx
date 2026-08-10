import { redirect } from "next/navigation";
import { es } from "@/i18n";
import { INVESTOR_HOME_ROUTE } from "@/lib/auth/routes";
import { getCurrentUser, getInvestorIds } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  fetchInvestmentOnboardingState,
  type OnboardingClient,
} from "@/lib/onboarding/investment";
import { InvestmentOnboardingStepper } from "./InvestmentOnboardingStepper";

/**
 * Investment onboarding: identity verification and contract signature.
 *
 * NOT the basic onboarding (/onboarding, personal data at sign-up). This one
 * happens afterwards, once an admin has linked the person as an investor —
 * which is the trigger, per user-management.md. There is no self-service entry:
 * somebody without a link is sent home rather than shown a flow they cannot be
 * in, and the actions refuse them again on the server.
 */
export default async function InvestmentOnboardingPage() {
  const user = await getCurrentUser();
  const investorIds = await getInvestorIds();

  // Eligibility is decided here, on the server, from the session.
  if (!user || investorIds.length === 0) {
    redirect(INVESTOR_HOME_ROUTE);
  }

  const supabase = await createClient();
  const state = await fetchInvestmentOnboardingState(
    supabase as unknown as OnboardingClient,
    user.id,
    investorIds
  );

  // Switched off by configuration: there is no flow to show.
  if (!state.applies) {
    redirect(INVESTOR_HOME_ROUTE);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-medium text-ink-900">
          {es.investmentOnboarding.title}
        </h1>
        <p className="text-base text-ink-500">
          {es.investmentOnboarding.subtitle}
        </p>
      </header>

      <InvestmentOnboardingStepper state={state} />
    </div>
  );
}
