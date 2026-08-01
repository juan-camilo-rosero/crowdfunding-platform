"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import { es } from "@/i18n";
import type { TableChanges, TableColumn, TableRow } from "@/lib/table/types";
import { Button } from "@/components/ui/button";
import { EditableDataTable } from "@/components/data-table/EditableDataTable";
import {
  TableTabsSelector,
  type TableTab,
} from "@/components/data-table/TableTabsSelector";
import { saveTableChanges } from "./actions";

const NO_CHANGES: TableChanges = { updates: [], inserts: [] };

export type AdminTablesPanelProps = {
  tabs: TableTab[];
  activeTabId: string;
  columns: TableColumn[];
  rows: TableRow[];
  allowInsert: boolean;
};

/**
 * Interactive shell of the admin panel: table picker, grid and batch save.
 *
 * Changes accumulate here until "Guardar cambios" is pressed, and are then sent
 * in ONE call that either applies everything or nothing.
 */
export function AdminTablesPanel({
  tabs,
  activeTabId,
  columns,
  rows,
  allowInsert,
}: AdminTablesPanelProps) {
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();
  const [changes, setChanges] = useState<TableChanges>(NO_CHANGES);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState(0);

  const pendingCount = changes.updates.length + changes.inserts.length;
  const hasChanges = pendingCount > 0;

  // Warn before a full page unload (reload, close, external link).
  useEffect(() => {
    if (!hasChanges) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasChanges]);

  function changeTab(tabId: string) {
    // In-app navigation does not trigger beforeunload, so it is guarded here.
    if (hasChanges && !window.confirm(es.admin.discardConfirm)) return;
    setChanges(NO_CHANGES);
    setError(null);
    router.push(`/admin?tabla=${tabId}`);
  }

  function save() {
    setError(null);
    startSaving(async () => {
      const result = await saveTableChanges(activeTabId, changes);

      if (!result.ok) {
        // Pending changes are kept so the admin can fix and retry.
        setError(result.error);
        return;
      }

      setChanges(NO_CHANGES);
      // Bumping this remounts the grid so it shows the persisted data.
      setSavedAt((count) => count + 1);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <TableTabsSelector
        tabs={tabs}
        activeTabId={activeTabId}
        onTabChange={changeTab}
      />

      <EditableDataTable
        key={`${activeTabId}-${savedAt}`}
        columns={columns}
        rows={rows}
        onChangesChange={setChanges}
        showNewRecordRow={allowInsert}
      />

      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="button"
          variant="brand"
          disabled={!hasChanges}
          loading={isSaving}
          loadingText={es.admin.saving}
          onClick={save}
          className="h-10.25 w-56.5 rounded-[5px] text-base font-medium"
        >
          {es.admin.saveChanges}
        </Button>

        {hasChanges && !isSaving ? (
          <p className="flex items-center gap-2 text-sm text-ink-500">
            <CircleAlertIcon className="size-4" aria-hidden="true" />
            {es.admin.unsavedNotice} ({pendingCount})
          </p>
        ) : null}

        {!hasChanges && savedAt > 0 && !error ? (
          <p className="flex items-center gap-2 text-sm text-ink-500">
            <CircleCheckIcon className="size-4" aria-hidden="true" />
            {es.admin.saveSuccess}
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
