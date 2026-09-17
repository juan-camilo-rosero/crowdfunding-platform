import { es } from "@/i18n";
import { createClient } from "@/lib/supabase/server";
import {
  getNotificationRecipients,
  type RecipientsClient,
} from "@/lib/notifications/recipients";
import { PageTitle } from "@/components/layout/PageTitle";
import { NotificationsComposerPanel } from "./NotificationsComposerPanel";

/**
 * Notifications — where an admin writes a message to investors.
 *
 * SCOPE: composing and sending. The automatic notification for a new project
 * is not configured here: it is a database trigger, so it fires no matter who
 * creates the project or through which screen.
 *
 * ACCESS: proxy.ts restricts /admin/* to role = 'admin', and the read below
 * runs under the admin's own session — investors_select_own only widens to
 * every row when public.is_admin() holds, so the database is what authorises
 * the recipient list, not this component.
 */
export default async function AdminNotificationsPage() {
  const supabase = await createClient();
  const { recipients, failed } = await getNotificationRecipients(
    supabase as unknown as RecipientsClient
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <PageTitle>{es.adminNotifications.title}</PageTitle>
        <p className="max-w-2xl text-base text-ink-500">
          {es.adminNotifications.subtitle}
        </p>
      </div>

      {failed ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-line bg-elevated px-6 py-4"
        >
          <p className="text-base text-destructive">
            {es.adminNotifications.loadError}
          </p>
          {/* Re-running the server component IS the retry. */}
          <a
            href="/admin/notificaciones"
            className="cursor-pointer text-sm font-medium text-ink-900 underline underline-offset-4"
          >
            {es.adminNotifications.retry}
          </a>
        </div>
      ) : (
        <NotificationsComposerPanel recipients={recipients} />
      )}
    </div>
  );
}
