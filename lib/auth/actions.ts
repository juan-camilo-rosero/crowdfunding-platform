"use server";

import { redirect } from "next/navigation";
import { LOGIN_ROUTE } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";

/**
 * Ends the session and sends the user back to /login.
 * Runs on the server so the auth cookies are cleared on the response.
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(LOGIN_ROUTE);
}
