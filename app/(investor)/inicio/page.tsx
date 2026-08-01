import { redirect } from "next/navigation";
import { es } from "@/i18n";
import { LOGIN_ROUTE } from "@/lib/auth/routes";
import { getCurrentUser, getCurrentUserProfile } from "@/lib/auth/session";

/**
 * TEMPORARY Sprint 1 placeholder: only confirms the session works.
 * The real home (KPIs, donut chart, activity feed — see views.md) comes later.
 */
export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect(LOGIN_ROUTE);
  }

  const profile = await getCurrentUserProfile();
  if (!profile) {
    redirect(`${LOGIN_ROUTE}?error=profile-not-found`);
  }

  return (
    <main className="flex flex-1 flex-col gap-3 p-8">
      <h1 className="text-xl font-semibold">{es.home.title}</h1>
      <dl className="flex flex-col gap-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-black/60 dark:text-white/60">
            {es.home.signedInAs}:
          </dt>
          <dd>{profile.email}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-black/60 dark:text-white/60">{es.home.role}:</dt>
          <dd>{profile.role}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-black/60 dark:text-white/60">{es.home.status}:</dt>
          <dd>{profile.status}</dd>
        </div>
      </dl>
    </main>
  );
}
