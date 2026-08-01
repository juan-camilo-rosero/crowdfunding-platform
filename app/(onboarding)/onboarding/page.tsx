import { redirect } from "next/navigation";
import { es } from "@/i18n";
import { LOGIN_ROUTE } from "@/lib/auth/routes";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { CompleteOnboardingButton } from "./CompleteOnboardingButton";

/**
 * TEMPORARY Sprint 1 placeholder: BASIC onboarding.
 *
 * The real one collects personal data (full name, phone, city/country). Truora
 * identity verification and contract signing do NOT belong here: they are part
 * of the later investment onboarding (see views.md and integrations.md).
 */
export default async function OnboardingPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    redirect(LOGIN_ROUTE);
  }

  return (
    <main className="flex flex-1 flex-col gap-3 p-8">
      <h1 className="text-xl font-semibold">{es.onboarding.title}</h1>
      <p className="text-sm text-black/60 dark:text-white/60">
        {es.onboarding.temporaryNotice}
      </p>
      <dl className="flex flex-col gap-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-black/60 dark:text-white/60">
            {es.onboarding.status}:
          </dt>
          <dd>{profile.status}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-black/60 dark:text-white/60">
            {es.onboarding.onboardingCompleted}:
          </dt>
          <dd>{profile.onboarding_completed ? es.onboarding.yes : es.onboarding.no}</dd>
        </div>
      </dl>

      <CompleteOnboardingButton />
    </main>
  );
}
