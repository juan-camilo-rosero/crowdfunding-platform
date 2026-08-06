import "server-only";
import { es } from "@/i18n";
import { formatCurrency } from "@/lib/format";
import { sendTransactionalEmail } from "@/lib/email/provider";

/**
 * Email notifications for a new investment interest.
 *
 * BEST EFFORT, ALWAYS. Every function here swallows its own failures and
 * returns void. The interest is already saved by the time these run — the row
 * is what the business relies on, and the notification is a convenience laid on
 * top. A missing API key, a bounced address or a provider outage must never
 * turn a saved interest into an error the user sees.
 */

export type InterestNotification = {
  projectName: string;
  investorName: string;
  investorEmail: string;
  amount?: number | null;
  investmentTypePref: string;
  comments?: string | null;
  phone?: string | null;
};

/** Where the team's notice goes. Absent means the notice is simply skipped. */
function notificationRecipient(): string | null {
  return process.env.INTEREST_NOTIFICATION_TO?.trim() || null;
}

/**
 * Confirmation to the investor is OFF unless explicitly enabled: writing to a
 * real person's inbox is not something to switch on by accident.
 */
function shouldConfirmToUser(): boolean {
  return process.env.SEND_INTEREST_CONFIRMATION?.trim().toLowerCase() === "true";
}

function describe(notification: InterestNotification): string {
  const typeLabel =
    es.projectDetail.interest.type[notification.investmentTypePref] ??
    notification.investmentTypePref;

  return [
    `Proyecto: ${notification.projectName}`,
    `Interesado: ${notification.investorName || "(sin nombre)"} <${notification.investorEmail}>`,
    `Monto de interés: ${
      notification.amount != null ? formatCurrency(notification.amount) : "no indicado"
    }`,
    `Tipo de inversión preferido: ${typeLabel}`,
    `Teléfono: ${notification.phone || "no indicado"}`,
    `Comentarios: ${notification.comments || "sin comentarios"}`,
  ].join("\n");
}

/**
 * Tells the team someone registered interest.
 *
 * Never throws and never reports back: the caller has nothing useful to do with
 * a mail failure, and giving it something to do would invite treating it as an
 * error.
 */
export async function notifyTeamOfInterest(
  notification: InterestNotification
): Promise<void> {
  const to = notificationRecipient();
  if (!to) {
    console.info(
      "[interest] INTEREST_NOTIFICATION_TO is not set — team notice skipped"
    );
    return;
  }

  try {
    await sendTransactionalEmail({
      to,
      subject: `Nuevo interés en ${notification.projectName}`,
      text: describe(notification),
      // So a reply goes to the person who asked, not into the void.
      replyTo: notification.investorEmail,
    });
  } catch (error) {
    console.error("[interest] team notice failed", error);
  }
}

/**
 * Optional confirmation to the investor. Behind SEND_INTEREST_CONFIRMATION.
 *
 * The wording stays sober: it acknowledges the message and says someone will be
 * in touch. It promises no timeline, no approval and no return.
 */
export async function confirmInterestToUser(
  notification: InterestNotification
): Promise<void> {
  if (!shouldConfirmToUser()) return;

  try {
    await sendTransactionalEmail({
      to: notification.investorEmail,
      subject: `Recibimos tu interés en ${notification.projectName}`,
      text: [
        `Hola${notification.investorName ? ` ${notification.investorName}` : ""},`,
        "",
        `Registramos tu interés en ${notification.projectName}.`,
        "El equipo de Investors 180 te contactará en los próximos días hábiles.",
        "",
        "Enviar este formulario no constituye un compromiso de inversión.",
      ].join("\n"),
    });
  } catch (error) {
    console.error("[interest] user confirmation failed", error);
  }
}
