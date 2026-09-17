/**
 * Who can receive a notification, and how the panel searches that list.
 *
 * WHO IS AN INVESTOR: a person with a LINKED row in `investors`. The capability
 * is derived from the link, never read from users.role (CLAUDE.md, "Roles y
 * seguridad"), which is the same rule the fan-out trigger applies in SQL — so
 * "todos los inversionistas" means the same set whether a project creates the
 * notification or an admin does.
 *
 * The id that travels from here is the USER id, not the investor id:
 * `notifications.user_id` points at the account, because that is what the
 * mobile app authenticates as and what `push_tokens` is keyed by. An investor
 * record with no account cannot be notified and is therefore not a recipient.
 */

type QueryBuilder = {
  select: (columns: string) => QueryBuilder;
  not: (column: string, operator: string, value: unknown) => QueryBuilder;
  order: (column: string, options: { ascending: boolean }) => QueryBuilder;
  then: Promise<{ data: unknown[] | null; error: unknown }>["then"];
};

export type RecipientsClient = {
  from: (table: string) => QueryBuilder;
};

type RawInvestor = {
  user_id: string | null;
  full_name: string | null;
  email: string | null;
};

export type NotificationRecipient = {
  /** auth.users id — what `notifications.user_id` stores. */
  userId: string;
  fullName: string | null;
  email: string | null;
};

export type RecipientsResult = {
  recipients: NotificationRecipient[];
  failed: boolean;
};

/**
 * Every investor who has an account, deduplicated by account.
 *
 * DEDUPLICATION is not cosmetic: nothing stops two investor records from
 * pointing at one person, and without this they would be listed twice and
 * notified twice. The trigger guards the same case with DISTINCT.
 *
 * Runs under the ADMIN's own session: investors_select_own widens to every row
 * only when public.is_admin() holds, so the database authorises this listing.
 */
export async function getNotificationRecipients(
  client: RecipientsClient
): Promise<RecipientsResult> {
  const { data, error } = await client
    .from("investors")
    .select("user_id, full_name, email")
    .not("user_id", "is", null)
    .order("full_name", { ascending: true });

  if (error) return { recipients: [], failed: true };

  const byUserId = new Map<string, NotificationRecipient>();

  for (const row of (data ?? []) as RawInvestor[]) {
    if (!row.user_id || byUserId.has(row.user_id)) continue;
    byUserId.set(row.user_id, {
      userId: row.user_id,
      fullName: row.full_name,
      email: row.email,
    });
  }

  return { recipients: [...byUserId.values()], failed: false };
}

/** Case-insensitive search over name and email, for the panel's filter box. */
export function searchRecipients(
  recipients: NotificationRecipient[],
  query: string
): NotificationRecipient[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return recipients;

  return recipients.filter(
    (recipient) =>
      (recipient.fullName ?? "").toLowerCase().includes(needle) ||
      (recipient.email ?? "").toLowerCase().includes(needle)
  );
}
