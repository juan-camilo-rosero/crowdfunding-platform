import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { es } from "@/i18n";
import { INVESTMENT_ONBOARDING_ROUTE } from "@/lib/auth/routes";
import { buttonVariants } from "@/components/ui/button";
import type { InvestmentOnboardingState } from "@/lib/onboarding/investment";

export type InvestmentOnboardingBannerProps = {
  state: InvestmentOnboardingState;
};

/**
 * Persistent invitation on /inicio to finish the activation.
 *
 * NON-BLOCKING on purpose: the investor keeps full use of the platform while it
 * is pending. Their capital and their reports are facts whether or not the
 * paperwork is done, and locking the portal behind a form would hide the very
 * data that makes finishing it worthwhile.
 *
 * It renders nothing once every applicable step is done — the reward for
 * finishing is that it goes away, which is why there is no dismiss button:
 * dismissing would leave the person with no way back and nothing to remind them.
 */
export function InvestmentOnboardingBanner({
  state,
}: InvestmentOnboardingBannerProps) {
  if (!state.applies || state.isComplete) return null;

  return (
    <section className="flex flex-wrap items-center gap-4 rounded-[10px] border border-line bg-elevated px-5 py-4">
      <div className="flex min-w-56 flex-1 flex-col gap-1">
        <p className="text-base font-medium text-ink-900">
          {es.investmentOnboarding.banner.title}
        </p>
        <p className="text-sm text-ink-700">
          {es.investmentOnboarding.banner.description}
        </p>
      </div>

      <Link
        href={INVESTMENT_ONBOARDING_ROUTE}
        className={buttonVariants({ variant: "brand", size: "lg" })}
      >
        {es.investmentOnboarding.banner.action}
        <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
      </Link>
    </section>
  );
}
