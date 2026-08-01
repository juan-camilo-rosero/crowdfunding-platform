import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Cliente con SUPABASE_SERVICE_ROLE_KEY: se salta Row Level Security por completo.
 * SOLO para operaciones de backend (webhooks de Truora/e-sign, jobs administrativos).
 * El import "server-only" hace fallar el build si este módulo se cuela en el bundle
 * del navegador. Nunca importar desde un Client Component ni desde lib/auth.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY no está configurada.");
  }

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
