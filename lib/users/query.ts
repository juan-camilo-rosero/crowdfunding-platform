import { normalizeEmail, type UserDirectoryEntry } from "./convertible";

/**
 * Reads for the admin's user directory (/admin/usuarios).
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
  role: string | null;
  onboarding_completed: boolean | null;
  created_at: string;
};

type RawInvestor = {
  user_id: string | null;
  email: string | null;
};

export type UserDirectoryResult = {
  users: UserDirectoryEntry[];
  failed: boolean;
};

/**
 * Every user, with the capabilities each one holds.
 *
 * The directory lists EVERYONE on purpose. An earlier version returned only the
 * people who could be converted, which meant that the moment an admin converted
 * someone they vanished with no confirmation, and there was no way to see who
 * was already an investor. Showing the whole set and marking each row is what
 * makes the screen answer "where does this person stand?" instead of only
 * "who is pending?".
 *
 * Whether someone is an investor cannot be expressed as a join in PostgREST
 * without an FK-embedded filter, so the linked ids are fetched once and matched
 * here. The set is small (the linked investors of the whole platform) and this
 * keeps the rule readable in one place.
 */
export async function getUserDirectory(
  client: UsersClient
): Promise<UserDirectoryResult> {
  const [usersResult, investorsResult] = await Promise.all([
    client
      .from("users")
      .select("id, full_name, email, phone, role, onboarding_completed, created_at")
      .order("created_at", { ascending: false }),
    // Every investor row, linked or not: the linked ones mark a user as an
    // investor, the unlinked ones flag a prospect waiting to be connected.
    client.from("investors").select("user_id, email"),
  ]);

  if (usersResult.error || investorsResult.error) {
    return { users: [], failed: true };
  }

  const investors = (investorsResult.data ?? []) as RawInvestor[];

  const linkedUserIds = new Set(
    investors.map((row) => row.user_id).filter((id): id is string => !!id)
  );

  // Emails of records that exist but belong to nobody yet (Camino A).
  const unlinkedEmails = new Set(
    investors
      .filter((row) => !row.user_id)
      .map((row) => normalizeEmail(row.email))
      .filter((email) => email.length > 0)
  );

  const users = ((usersResult.data ?? []) as RawUser[]).map((user) => {
    const isAdmin = user.role === "admin";
    const isInvestor = linkedUserIds.has(user.id);
    const onboardingCompleted = !!user.onboarding_completed;

    return {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      phone: user.phone,
      createdAt: user.created_at,
      isAdmin,
      isInvestor,
      onboardingCompleted,
      hasMatchingProspect: unlinkedEmails.has(normalizeEmail(user.email)),
      // The same three conditions the Server Action enforces.
      canConvert: !isAdmin && !isInvestor && onboardingCompleted,
    };
  });

  return { users, failed: false };
}

/** Case-insensitive search over name and email, for the list's filter box. */
export function searchUsers(
  users: UserDirectoryEntry[],
  query: string
): UserDirectoryEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return users;

  return users.filter(
    (user) =>
      (user.fullName ?? "").toLowerCase().includes(needle) ||
      user.email.toLowerCase().includes(needle)
  );
}
