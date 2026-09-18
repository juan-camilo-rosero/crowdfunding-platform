"use server";

import { revalidatePath } from "next/cache";
import { es } from "@/i18n";
import { isAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { withRetiredLegacyReturn } from "@/lib/table/legacy-return";
import { validateRow } from "@/lib/table/validation";
import { findAdminTable } from "@/app/(admin)/admin/table-definitions";

/** The projects table as the admin panel defines it — one definition, two screens. */
const PROJECTS_TABLE = findAdminTable("proyectos");

export type UpdateProjectResult = { ok: true } | { ok: false; error: string };

/**
 * Edits a project FROM ITS PUBLIC PAGE, as an admin.
 *
 * Same write as the panel's: the same column definitions, the same
 * server-side validation and the same `admin_save_table_changes` function,
 * which re-checks the admin role and only accepts whitelisted tables. What is
 * NOT shared is the revalidation — this one has to refresh the page the edit
 * was made on and the catalogue behind it, not the panel.
 *
 * It lives in the route rather than beside the panel's action so that the
 * investor screens do not import an admin Server Action they have no business
 * calling; the authorisation, of course, does not depend on where the file is.
 */
export async function updateProjectFromDetail(
  projectId: string,
  values: Record<string, string>
): Promise<UpdateProjectResult> {
  if (!(await isAdmin())) {
    return { ok: false, error: es.admin.notAuthorized };
  }

  if (!projectId) {
    return { ok: false, error: es.validation.unknownTable };
  }

  if (Object.keys(values).length === 0) {
    return { ok: false, error: es.validation.emptyBatch };
  }

  // Unknown, read-only and malformed values are refused here, before anything
  // is written — exactly as they are for the grid.
  const validated = validateRow(PROJECTS_TABLE.columns, values, "update");
  if (!validated.ok) {
    return { ok: false, error: validated.error };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_save_table_changes", {
    p_table: PROJECTS_TABLE.source,
    p_updates: [
      {
        id: projectId,
        values: withRetiredLegacyReturn(PROJECTS_TABLE.source, validated.values),
      },
    ],
    p_inserts: [],
  });

  if (error) {
    // The database message is already in Spanish for the cases we raise.
    return { ok: false, error: error.message || es.admin.saveError };
  }

  revalidatePath(`/proyecto/${projectId}`);
  revalidatePath("/portafolio");
  revalidatePath("/mis-inversiones");
  revalidatePath("/admin");

  return { ok: true };
}
