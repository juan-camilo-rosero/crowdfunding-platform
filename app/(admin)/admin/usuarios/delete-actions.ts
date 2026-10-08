"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { es } from "@/i18n";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { whyNotDeletable } from "@/lib/users/deletable";

const ADMIN_USERS_ROUTE = "/admin/usuarios";

const inputSchema = z.object({ userId: z.uuid() });

export type DeleteUserResult =
  | { ok: true; keptInvestorRecord: boolean }
  | { ok: false; error: string };

/**
 * Deletes a user ACCOUNT.
 *
 * It lives apart from actions.ts on purpose: that file states that the service
 * role key is deliberately absent from it, and this operation cannot be done
 * without it — removing an identity is an Auth operation, not a table write,
 * and only the service role may call it.
 *
 * THE AUTHORISATION IS STILL NOT THE SERVICE ROLE'S. Everything that decides
 * whether the deletion may happen is read through the CALLER'S OWN session,
 * under RLS: their role, the target, the investor link, how many admins are
 * left. The service role is used for exactly one statement, after the answer
 * is already yes.
 *
 * WHAT IT DESTROYS, and what it cannot: the login, the identity verification,
 * the interests, the notifications and the device tokens, all by cascade. The
 * investor's file is ON DELETE SET NULL, so it survives, unlinked — and with
 * it every contribution and transaction, which hang off that file and not off
 * the account. No financial record is ever removed here. See
 * lib/users/deletable.ts.
 */
export async function deleteUserAccount(input: unknown): Promise<DeleteUserResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: es.adminUsers.errors.notFound };
  }
  const { userId } = parsed.data;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: es.adminUsers.errors.notAdmin };
  }

  // 1. The caller must be an admin, read from their own row.
  const { data: caller } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (caller?.role !== "admin") {
    return { ok: false, error: es.adminUsers.errors.notAdmin };
  }

  // 2. The account being deleted, and how many admins would be left.
  const { data: target, count: adminCount } = await supabase
    .from("users")
    .select("id, email, full_name, role", { count: "exact" })
    .eq("id", userId)
    .maybeSingle();

  if (!target) {
    return { ok: false, error: es.adminUsers.errors.notFound };
  }

  const { count: admins } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");

  // 3. Is it linked to an investor file? Only to TELL the admin what survives.
  const { data: links } = await supabase
    .from("investors")
    .select("id")
    .eq("user_id", userId);

  const refusal = whyNotDeletable(
    {
      id: target.id,
      isAdmin: target.role === "admin",
      isInvestor: (links ?? []).length > 0,
    },
    { callerId: user.id, adminCount: admins ?? adminCount ?? 0 }
  );

  if (refusal === "self") {
    return { ok: false, error: es.adminUsers.errors.deleteSelf };
  }
  if (refusal === "last-admin") {
    return { ok: false, error: es.adminUsers.errors.deleteLastAdmin };
  }

  // 4. The one statement that needs the service role. Deleting the auth user
  //    cascades into public.users, and from there into everything that hangs
  //    off the account.
  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      console.error("[usuarios] no se pudo eliminar la cuenta", { userId, error });
      return { ok: false, error: es.adminUsers.errors.deleteFailed };
    }
  } catch (error) {
    // A missing service role key throws rather than returning an error.
    console.error("[usuarios] fallo al eliminar la cuenta", { userId, error });
    return { ok: false, error: es.adminUsers.errors.deleteFailed };
  }

  revalidatePath(ADMIN_USERS_ROUTE);
  revalidatePath("/admin");

  return { ok: true, keptInvestorRecord: (links ?? []).length > 0 };
}
