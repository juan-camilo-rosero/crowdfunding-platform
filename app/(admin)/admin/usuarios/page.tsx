import { es } from "@/i18n";
import { createClient } from "@/lib/supabase/server";
import { getUserDirectory, type UsersClient } from "@/lib/users/query";
import { PageTitle } from "@/components/layout/PageTitle";
import { UsersDirectoryPanel } from "./UsersDirectoryPanel";

/**
 * Users — the directory, and the linking funnel of Camino B
 * (user-management.md).
 *
 * SCOPE: seeing where every person stands, and converting a visitor into an
 * investor. Managing account status, granting or removing admin, and unlinking
 * are a separate screen; none of them is reachable from here.
 *
 * ACCESS: proxy.ts restricts /admin/* to role = 'admin', and the reads below
 * run under the admin's own session — users_select_own and investors_select_own
 * only widen to every row when public.is_admin() holds, so the database is what
 * authorises the listing, not this component.
 */
export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { users, failed } = await getUserDirectory(
    supabase as unknown as UsersClient
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <PageTitle>{es.adminUsers.title}</PageTitle>
        <p className="max-w-2xl text-base text-ink-500">
          {es.adminUsers.subtitle}
        </p>
      </div>

      {failed ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-line bg-elevated px-6 py-4"
        >
          <p className="text-base text-destructive">{es.adminUsers.loadError}</p>
          {/* Re-running the server component IS the retry. */}
          <a
            href="/admin/usuarios"
            className="cursor-pointer text-sm font-medium text-ink-900 underline underline-offset-4"
          >
            {es.adminUsers.retry}
          </a>
        </div>
      ) : (
        <UsersDirectoryPanel users={users} />
      )}
    </div>
  );
}
