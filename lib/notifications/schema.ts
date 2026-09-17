import { z } from "zod";
import { es } from "@/i18n";

/**
 * Shape and local rules of a manual notification.
 *
 * ONE schema, run by both halves: the composer runs it to enable its button,
 * the Server Action runs it again before writing. What it deliberately does NOT
 * decide is WHO the recipients are — `userIds` is a request, and the action
 * intersects it with the investors that actually exist (see actions.ts). A
 * client-supplied id is never written straight into `notifications.user_id`.
 */

/**
 * Expo truncates long pushes per platform, and a notification that reads as a
 * cut-off sentence on the phone is worse than a short one. These ceilings keep
 * the composer honest; they are limits of the medium, not of the column.
 */
export const NOTIFICATION_TITLE_MAX = 80;
export const NOTIFICATION_BODY_MAX = 300;

/**
 * Written into `notifications.data` so the app can route the tap. The trigger's
 * counterpart is "project_created"; this is the manual one, which carries no
 * destination because there is nothing to open.
 */
export const MANUAL_NOTIFICATION_TYPE = "admin_message";

export const sendNotificationSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, es.adminNotifications.errors.titleRequired)
      .max(NOTIFICATION_TITLE_MAX, es.adminNotifications.errors.titleTooLong),
    body: z
      .string()
      .trim()
      .min(1, es.adminNotifications.errors.bodyRequired)
      .max(NOTIFICATION_BODY_MAX, es.adminNotifications.errors.bodyTooLong),
    /**
     * "all" resolves at send time, on the server. It is not the same as the ids
     * the composer happens to be showing: an investor linked while the admin
     * was typing is included, which is what the admin asked for.
     */
    audience: z.enum(["all", "selected"]),
    userIds: z.array(z.uuid()),
  })
  .refine(
    (value) => value.audience === "all" || value.userIds.length > 0,
    { message: es.adminNotifications.errors.noRecipients, path: ["userIds"] }
  );

export type SendNotificationInput = z.infer<typeof sendNotificationSchema>;

export type SendNotificationResult =
  | { ok: true; count: number }
  | { ok: false; error: string };
