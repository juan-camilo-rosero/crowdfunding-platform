import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Client using SUPABASE_SERVICE_ROLE_KEY: it bypasses Row Level Security
 * entirely. ONLY for backend operations (Truora/e-sign webhooks, admin jobs).
 * The "server-only" import fails the build if this module ever reaches the
 * browser bundle. Never import it from a Client Component or from lib/auth.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
