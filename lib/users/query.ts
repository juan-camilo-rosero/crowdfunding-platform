import {
  normalizeEmail,
  type ConvertibleUser,
} from "./convertible";

/**
 * Reads for the linking funnel (/admin/usuarios).
 *
 * Everything here runs as the ADMIN, under their own session, so RLS is what
 * authorises the wide reads: users_select_own admits any row when
 * public.is_admin(), and investors_select_own does the same. No service role is
 * involved anywhere in this feature.
 */

type QueryBuilder = {
  select: (columns: string) => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  neq: (column: string, value: unknown) => QueryBuilder;
  is: (column: string, value: unknown) => QueryBuilder;
  not: (column: string, operator: string, value: unknown) => QueryBuilder;
  order: (column: string, options: { ascending: boolean }) => QueryBuilder;
  then: Promise<{ data: unknown[] | null; error: unknown }>["then"];
};

export type UsersClient = {
  from: (table: string) => QueryBuilder;
};

type RawUser = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  created_at: string;
};

type RawInvestor = {
  user_id: string | null;
  email: string | null;
};

export type ConvertibleUsersResult = {
  users: ConvertibleUser[];
  failed: boolean;
};

/**
 * Users an admin can turn into investors.
 *
 * The population is defined by three conditions, all of which matter:
 *
 *  · role != 'admin' — an admin is managed through the admin flow, not this
 *    one. (Note this does NOT exclude an admin who also invests; it excludes
 *    them from being converted HERE.)
 *  · onboarding_completed — someone who has not given their personal data has
 *    no name or phone to build a record from.
 *  · no linked row in `investors` — they are already an investor otherwise, and
 *    a second row would be a duplicate identity.
 *
 * The third condition cannot be expressed as a join in PostgREST without an
 * FK-embedded filter, so the linked ids are fetched once and subtracted here.
 * The set is small (the linked investors of the whole platform) and this keeps
 * the rule readable in one place.
 */
export async function getConvertibleUsers(
  client: UsersClient
): Promise<ConvertibleUsersResult> {
  const [usersResult, investorsResult] = await Promise.all([
    client
      .from("users")
      .select("id, full_name, email, phone, created_at")
      .neq("role", "admin")
      .eq("onboarding_completed", true)
      .order("created_at", { ascending: false }),
    // Every investor row, linked or not: the linked ones exclude users, the
    // unlinked ones flag a prospect waiting to be connected.
    client.from("investors").select("user_id, email"),
  ]);

  if (usersResult.error || investorsResult.error) {
    return { users: [], failed: true };
  }

  const investors = (investorsResult.data ?? []) as RawInvestor[];

  const linkedUserIds = new Set(
    investors
      .map((row) => row.user_id)
      .filter((id): id is string => !!id)
  );

  // Emails of records that exist but belong to nobody yet (Camino A).
  const unlinkedEmails = new Set(
    investors
      .filter((row) => !row.user_id)
      .map((row) => normalizeEmail(row.email))
      .filter((email) => email.length > 0)
  );

  const users = ((usersResult.data ?? []) as RawUser[])
    .filter((user) => !linkedUserIds.has(user.id))
    .map((user) => ({
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      phone: user.phone,
      createdAt: user.created_at,
      hasMatchingProspect: unlinkedEmails.has(normalizeEmail(user.email)),
    }));

  return { users, failed: false };
}

/** Case-insensitive search over name and email, for the list's filter box. */
export function searchConvertibleUsers(
  users: ConvertibleUser[],
  query: string
): ConvertibleUser[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return users;

  return users.filter(
    (user) =>
      (user.fullName ?? "").toLowerCase().includes(needle) ||
      user.email.toLowerCase().includes(needle)
  );
}
