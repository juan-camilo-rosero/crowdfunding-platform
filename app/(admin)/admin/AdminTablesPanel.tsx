"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { es } from "@/i18n";
import type { TableColumn, TableRow } from "@/lib/table/types";
import { Button } from "@/components/ui/button";
import { EditableDataTable } from "@/components/data-table/EditableDataTable";
import {
  TableTabsSelector,
  type TableTab,
} from "@/components/data-table/TableTabsSelector";

export type AdminTablesPanelProps = {
  tabs: TableTab[];
  activeTabId: string;
  columns: TableColumn[];
  rows: TableRow[];
};

/**
 * Interactive shell of the admin panel: table picker, grid and save button.
 * Switching tabs is a navigation (`?tabla=`), so the server re-queries the
 * matching Supabase table and RLS keeps applying.
 */
export function AdminTablesPanel({
  tabs,
  activeTabId,
  columns,
  rows,
}: AdminTablesPanelProps) {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const [pendingEdits, setPendingEdits] = useState(0);

  return (
    <div className="flex flex-col gap-6">
      <TableTabsSelector
        tabs={tabs}
        activeTabId={activeTabId}
        onTabChange={(tabId) =>
          startNavigation(() => router.push(`/admin?tabla=${tabId}`))
        }
      />

      {/*
        The grid is the one block allowed to exceed the protected content width,
        so it breaks out of the centered column and scrolls on its own.
      */}
      <div
        aria-busy={isNavigating || undefined}
        className={isNavigating ? "opacity-60 transition-opacity" : undefined}
      >
        {/*
          `key` per table is load-bearing: switching tabs only changes props, so
          without it React keeps this component mounted and its local state
          (drafts, created rows, edits) leaks into the next table.
        */}
        <EditableDataTable
          key={activeTabId}
          columns={columns}
          rows={rows}
          onCellChange={() => setPendingEdits((count) => count + 1)}
          onRowCreate={() => setPendingEdits((count) => count + 1)}
        />
      </div>

      <div className="flex items-center gap-4">
        {/* PENDING: no persistence yet; the save mechanics come later. */}
        <Button
          type="button"
          variant="brand"
          className="h-10.25 w-56.5 rounded-[5px] text-base font-medium"
        >
          {es.admin.saveChanges}
        </Button>

        {pendingEdits > 0 ? (
          <p className="text-sm text-ink-500">{es.admin.unsavedNotice}</p>
        ) : null}
      </div>
    </div>
  );
}
