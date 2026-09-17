"use server";

import { revalidatePath } from "next/cache";
import { es } from "@/i18n";
import { createClient } from "@/lib/supabase/server";
import {
  getNotificationRecipients,
  type RecipientsClient,
} from "@/lib/notifications/recipients";
import {
  MANUAL_NOTIFICATION_TYPE,
  sendNotificationSchema,
  type SendNotificationResult,
} from "@/lib/notifications/schema";

const ADMIN_NOTIFICATIONS_ROUTE = "/admin/notificaciones";

/**
 * Sends a notification to one, several or every investor.
 *
 * WHAT SENDING IS HERE: writing one row per recipient into `notifications`, and
 * nothing else. The Database Webhook on that table hands each row to the
 * push-send Edge Function, which is the only code that talks to Expo. Doing any
 * delivery work here would mean two pipelines to keep in step, and the
 * new-project trigger — which cannot call a Server Action — would still need
 * the other one.
 *
 * AUTHORISATION is enforced twice, and neither half trusts the client:
 *   · this function reads the caller's own profile and refuses a non-admin;
 *   · the insert runs on the SESSION-BOUND client, so the policy "admins send
 *     notifications" re-checks public.is_admin() inside the database.
 * SUPABASE_SERVICE_ROLE_KEY is deliberately absent from this file: it would
 * bypass RLS and remove the second barrier.
 *
 * RECIPIENTS ARE RESOLVED SERVER-SIDE. The ids that arrive are a request, not
 * an instruction: they are intersected with the investors that actually exist,
 * so a hand-crafted payload cannot push a message to an arbitrary account.
 */
export async function sendNotification(
  input: unknown
): Promise<SendNotificationResult> {
  const parsed = sendNotificationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ??
        es.adminNotifications.errors.sendFailed,
    };
  }

  const { title, body, audience, userIds } = parsed.data;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: es.adminNotifications.errors.notAdmin };
  }

  // 1. The caller must be an admin. Read from their own row, server side.
  const { data: caller } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (caller?.role !== "admin") {
    return { ok: false, error: es.adminNotifications.errors.notAdmin };
  }

  // 2. Who exists. Same definition of "investor" as the fan-out trigger: a
  // linked row in `investors`, deduplicated by account.
  const { recipients, failed } = await getNotificationRecipients(
    supabase as unknown as RecipientsClient
  );

  if (failed) {
    return { ok: false, error: es.adminNotifications.errors.sendFailed };
  }

  const linkedUserIds = new Set(recipients.map((recipient) => recipient.userId));

  // 3. "all" is resolved now, not when the composer rendered: somebody linked
  // in the meantime is included, which is what the admin asked for.
  const targets =
    audience === "all"
      ? [...linkedUserIds]
      : userIds.filter((id) => linkedUserIds.has(id));

  if (targets.length === 0) {
    return {
      ok: false,
      error:
        audience === "all"
          ? es.adminNotifications.errors.noRecipients
          : es.adminNotifications.errors.recipientsGone,
    };
  }

  // 4. One row per recipient. A shared row would be unreadable under RLS (the
  // policy is "your own rows") and unpushable (tokens are looked up per user).
  const rows = targets.map((userId) => ({
    user_id: userId,
    title,
    body,
    data: { type: MANUAL_NOTIFICATION_TYPE },
  }));

  // No .select() on purpose: PostgREST would try to read the rows back, and
  // "users read own notifications" does not admit the admin as a reader of
  // somebody else's feed — the insert would succeed and the response fail.
  const { error } = await supabase.from("notifications").insert(rows);

  if (error) {
    return { ok: false, error: es.adminNotifications.errors.sendFailed };
  }

  revalidatePath(ADMIN_NOTIFICATIONS_ROUTE);
  return { ok: true, count: rows.length };
}
