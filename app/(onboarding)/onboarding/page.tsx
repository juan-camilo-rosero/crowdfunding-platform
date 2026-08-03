import { redirect } from "next/navigation";
import { es } from "@/i18n";
import { LOGIN_ROUTE } from "@/lib/auth/routes";
import { getCurrentUserProfile } from "@/lib/auth/session";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { OnboardingForm } from "./OnboardingForm";

/**
 * BASIC onboarding: personal data, nothing else.
 *
 * Identity verification (Truora) and contract signing do NOT belong here — they
 * are part of the later investment onboarding (views.md, integrations.md).
 *
 * Every authenticated user without onboarding_completed passes through, whatever
 * their capabilities; proxy.ts sends them here and keeps everybody else out.
 * The email is not asked for — it already came from the sign-up, so it is shown
 * as read-only context instead of as a field to retype.
 */
export default async function OnboardingPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    redirect(LOGIN_ROUTE);
  }

  return (
    <AuthSplitLayout
      title={es.onboarding.title}
      subtitle={es.onboarding.subtitle}
      // Four fields need more room than the login's single one.
      contentClassName="max-w-[420px]"
    >
      <p className="mt-3 text-center text-sm text-ink-400">
        {es.onboarding.signedInAs}{" "}
        <span className="text-ink-500">{profile.email}</span>
      </p>

      <OnboardingForm />
    </AuthSplitLayout>
  );
}
