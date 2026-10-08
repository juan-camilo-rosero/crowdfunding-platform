"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { es } from "@/i18n";
import { isAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isDeletableTable } from "@/lib/table/deletable-rows";
import { findAdminTable, ADMIN_TABLES } from "./table-definitions";

export type DeleteRowResult = { ok: true } | { ok: false; error: string };

const idSchema = z.uuid();

/**
 * Deletes one row of an admin table.
 *
 * Three barriers, in this order: the admin check here, the whitelist of
 * deletable tables (lib/table/deletable-rows.ts), and the database function
 * `admin_delete_table_row`, which re-checks the role, keeps its OWN shorter
 * whitelist and refuses an approved reassignment outright. The last one is the
 * barrier that holds if this file is ever bypassed.
 *
 * Separate from saveTableChanges on purpose: that one writes batches and
 * accepts nine tables; this one removes a single row and accepts eight, and
 * conflating them would mean one whitelist for two very different risks.
 */
export async function deleteTableRow(
  tableId: string,
  rowId: string
): Promise<DeleteRowResult> {
  if (!(await isAdmin())) {
    return { ok: false, error: es.admin.notAuthorized };
  }

  // An unknown tab must not fall back to the first table and delete there.
  const known = ADMIN_TABLES.some((table) => table.id === tableId);
  if (!known) {
    return { ok: false, error: es.validation.unknownTable };
  }

  const definition = findAdminTable(tableId);
  if (!isDeletableTable(definition.source)) {
    return { ok: false, error: es.admin.delete.tableNotAllowed };
  }

  if (!idSchema.safeParse(rowId).success) {
    return { ok: false, error: es.admin.delete.noId };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_delete_table_row", {
    p_table: definition.source,
    p_id: rowId,
  });

  if (error) {
    // The messages this function raises are already in Spanish.
    return { ok: false, error: error.message || es.admin.delete.failed };
  }

  // Nothing deleted means the row was already gone — someone else's doing, or
  // a stale screen. Saying "listo" would be a lie.
  const deleted = (data as { deleted?: number } | null)?.deleted ?? 0;
  if (deleted === 0) {
    return { ok: false, error: es.admin.delete.failed };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/pipeline");

  return { ok: true };
}
