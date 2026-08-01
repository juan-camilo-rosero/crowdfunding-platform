import { redirect } from "next/navigation";
import { es } from "@/i18n";
import { LOGIN_ROUTE } from "@/lib/auth/routes";
import { getCurrentUserProfile } from "@/lib/auth/session";

/**
 * TEMPORARY Sprint 1 placeholder.
 *
 * This is where a visitor lands after basic onboarding, so it must exist even
 * though the real catalog (card grid, filters, status badges — see views.md)
 * comes later: without this page every new user fell into a 404.
 */
export default async function CatalogPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    redirect(LOGIN_ROUTE);
  }

  return (
    <main className="flex flex-1 flex-col gap-3 p-8">
      <h1 className="text-xl font-semibold">{es.catalog.title}</h1>
      <p className="text-sm text-black/60 dark:text-white/60">
        {es.catalog.placeholder}
      </p>
      <dl className="flex flex-col gap-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-black/60 dark:text-white/60">{es.home.role}:</dt>
          <dd>{profile.role}</dd>
        </div>
      </dl>
    </main>
  );
}
