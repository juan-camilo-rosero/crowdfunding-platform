import { es } from "@/i18n";
import type { TableRow } from "./types";

/**
 * Which rows of the admin panel may be deleted, and which must not.
 *
 * THE LINE IS DRAWN BY WHAT HANGS OFF THE ROW, read from the real foreign keys
 * (see the schema dump, 2026-10-08):
 *
 *   · transactions, budget_items, tasks, monthly_reports, investment_interests
 *     are leaves — nothing references them, so deleting one takes nothing else
 *     with it;
 *   · capital_contributions and documents are referenced only by
 *     signing_requests, with ON DELETE SET NULL: the signature record survives
 *     and merely loses the link;
 *   · reassignment_requests are leaves too, but an APPROVED one is not: the
 *     capital it moved is read from it by investor_project_position, and
 *     approving it also wrote a transaction. Deleting it would move money back
 *     without a trace, so only pending and rejected ones may go.
 *
 * NEVER projects or investors. A project cascades into its budget, its tasks,
 * its reports and the interests received; an investor cascades into their
 * tickets and signing requests — and both are RESTRICTed by the financial
 * tables, so the database would refuse half the time and silently destroy the
 * other half. To retire either one there is a status field.
 *
 * This is the UI's copy of the rule. The database enforces its own, in
 * `admin_delete_table_row`, which is the barrier that holds.
 */
export const DELETABLE_TABLES: readonly string[] = [
  "transactions",
  "budget_items",
  "tasks",
  "monthly_reports",
  "documents",
  "investment_interests",
  "capital_contributions",
  "reassignment_requests",
];

export function isDeletableTable(source: string): boolean {
  return DELETABLE_TABLES.includes(source);
}

/** The reason this row may not be deleted, or null when it may. */
export function whyRowCannotBeDeleted(source: string, row: TableRow): string | null {
  if (!isDeletableTable(source)) return es.admin.delete.tableNotAllowed;
  if (!row.id) return es.admin.delete.noId;

  if (source === "reassignment_requests" && row.status === "aprobada") {
    return es.admin.delete.approvedRequest;
  }

  return null;
}
