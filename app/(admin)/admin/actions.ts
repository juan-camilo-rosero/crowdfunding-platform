"use server";

import { revalidatePath } from "next/cache";
import { es } from "@/i18n";
import { isAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { validateRow } from "@/lib/table/validation";
import type { TableChanges } from "@/lib/table/types";
import { ADMIN_TABLES } from "./table-definitions";

export type SaveTableResult =
  | { ok: true; updated: number; inserted: number }
  | { ok: false; error: string };

/**
 * Persists a batch of table edits.
 *
 * Everything is ALL-OR-NOTHING: the writes happen inside
 * `admin_save_table_changes`, a single Postgres function, so one failure rolls
 * the whole batch back. That matters because these are financial records.
 *
 * Three independent barriers guard the write:
 *   1. this check, so a non-admin gets refused before anything is parsed;
 *   2. server-side validation derived from the column definitions;
 *   3. the database function, which re-checks the admin role and only accepts
 *      whitelisted tables (it runs SECURITY DEFINER, so RLS does not apply).
 *
 * Generic on purpose: it takes a table id and works for every admin table.
 */
export async function saveTableChanges(
  tableId: string,
  changes: TableChanges
): Promise<SaveTableResult> {
  if (!(await isAdmin())) {
    return { ok: false, error: es.admin.notAuthorized };
  }

  const definition = ADMIN_TABLES.find((table) => table.id === tableId);
  if (!definition) {
    return { ok: false, error: es.validation.unknownTable };
  }

  const updates = changes.updates ?? [];
  const inserts = changes.inserts ?? [];

  if (updates.length === 0 && inserts.length === 0) {
    return { ok: false, error: es.validation.emptyBatch };
  }

  if (inserts.length > 0 && definition.allowInsert === false) {
    return { ok: false, error: es.admin.notAuthorized };
  }

  // Validate EVERYTHING before writing anything: a batch that would fail
  // halfway must never reach the database.
  const validatedUpdates: { id: string; values: Record<string, string | null> }[] = [];
  for (const update of updates) {
    const result = validateRow(definition.columns, update.values, "update");
    if (!result.ok) return { ok: false, error: result.error };
    validatedUpdates.push({ id: update.id, values: result.values });
  }

  const validatedInserts: Record<string, string | null>[] = [];
  for (const insert of inserts) {
    const result = validateRow(definition.columns, insert, "insert");
    if (!result.ok) return { ok: false, error: result.error };
    validatedInserts.push(result.values);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_save_table_changes", {
    p_table: definition.source,
    p_updates: validatedUpdates,
    p_inserts: validatedInserts,
  });

  if (error) {
    // The database message is already in Spanish for the cases we raise.
    return { ok: false, error: error.message || es.admin.saveError };
  }

  revalidatePath("/admin");

  const summary = (data ?? {}) as { updated?: number; inserted?: number };
  return {
    ok: true,
    updated: summary.updated ?? 0,
    inserted: summary.inserted ?? 0,
  };
}
