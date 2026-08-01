"use client";

import { useRouter } from "next/navigation";
import type { TableChanges, TableColumn, TableRow } from "@/lib/table/types";
import { BatchEditPanel } from "@/components/data-table/BatchEditPanel";
import {
  TableTabsSelector,
  type TableTab,
} from "@/components/data-table/TableTabsSelector";
import { saveTableChanges } from "./actions";

export type AdminTablesPanelProps = {
  tabs: TableTab[];
  activeTabId: string;
  columns: TableColumn[];
  rows: TableRow[];
  allowInsert: boolean;
};

/**
 * Admin panel screen: the shared batch editor with a table picker on top.
 * Switching tabs is a navigation, so the server re-queries and RLS keeps
 * applying.
 */
export function AdminTablesPanel({
  tabs,
  activeTabId,
  columns,
  rows,
  allowInsert,
}: AdminTablesPanelProps) {
  const router = useRouter();

  return (
    <BatchEditPanel
      tableId={activeTabId}
      datasetKey={activeTabId}
      columns={columns}
      rows={rows}
      allowInsert={allowInsert}
      onSave={(changes: TableChanges) => saveTableChanges(activeTabId, changes)}
      renderFilter={(guard) => (
        <TableTabsSelector
          tabs={tabs}
          activeTabId={activeTabId}
          onTabChange={(tabId) =>
            guard(() => router.push(`/admin?tabla=${tabId}`))
          }
        />
      )}
    />
  );
}
