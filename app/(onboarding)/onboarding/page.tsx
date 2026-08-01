import { redirect } from "next/navigation";
import { es } from "@/i18n";
import { getCurrentUserProfile } from "@/lib/auth/session";

/**
 * PLACEHOLDER temporal del Sprint 1.
 * El onboarding real (datos personales → Truora → firma del contrato, ver
 * views.md e integrations.md) se construye en etapas posteriores.
 */
export default async function OnboardingPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    redirect("/login?error=sesion-requerida");
  }

  return (
    <main className="flex flex-1 flex-col gap-3 p-8">
      <h1 className="text-xl font-semibold">{es.onboarding.titulo}</h1>
      <dl className="flex flex-col gap-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-black/60 dark:text-white/60">
            {es.onboarding.estado}:
          </dt>
          <dd>{profile.status}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-black/60 dark:text-white/60">
            {es.onboarding.onboardingCompletado}:
          </dt>
          <dd>
            {profile.onboarding_completed ? es.onboarding.si : es.onboarding.no}
          </dd>
        </div>
      </dl>
    </main>
  );
}
