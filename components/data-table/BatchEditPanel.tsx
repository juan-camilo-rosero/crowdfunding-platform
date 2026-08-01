"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import { es } from "@/i18n";
import type { TableChanges, TableColumn, TableRow } from "@/lib/table/types";
import { Button } from "@/components/ui/button";
import { EditableDataTable } from "./EditableDataTable";

const NO_CHANGES: TableChanges = { updates: [], inserts: [] };

/**
 * Runs a navigation only after confirming that pending edits may be discarded.
 * Handed to the filter control so every screen guards the same way.
 */
export type NavigationGuard = (navigate: () => void) => void;

export type BatchEditPanelProps = {
  /** Admin table id handed to the save action. */
  tableId: string;
  columns: TableColumn[];
  rows: TableRow[];
  allowInsert: boolean;
  /** Changing this remounts the grid, clearing drafts and edits. */
  datasetKey: string;
  /** Filter control (tabs, dropdown…). Receives the unsaved-changes guard. */
  renderFilter?: (guard: NavigationGuard) => ReactNode;
  /**
   * Persists the batch. Injected so each screen can adapt the payload before
   * sending it, while the accumulate → confirm → save → reset flow stays here.
   */
  onSave: (changes: TableChanges) => Promise<{ ok: boolean; error?: string }>;
};

/**
 * Shared shell for every editable-table screen: grid, batch accumulation,
 * save button, unsaved-changes warnings and navigation guard.
 *
 * The admin panel and the sales funnel differ only in their filter control and
 * in how the payload is prepared, so both pass those in instead of copying the
 * ~80 lines of state handling.
 */
export function BatchEditPanel({
  tableId,
  columns,
  rows,
  allowInsert,
  datasetKey,
  renderFilter,
  onSave,
}: BatchEditPanelProps) {
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

  // In-app navigation does not fire beforeunload, so it is guarded here.
  const guard: NavigationGuard = (navigate) => {
    if (hasChanges && !window.confirm(es.admin.discardConfirm)) return;
    setChanges(NO_CHANGES);
    setError(null);
    navigate();
  };

  function save() {
    setError(null);
    startSaving(async () => {
      const result = await onSave(changes);

      if (!result.ok) {
        // Pending changes are kept so the admin can fix and retry.
        setError(result.error ?? es.admin.saveError);
        return;
      }

      setChanges(NO_CHANGES);
      setSavedAt((count) => count + 1);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {renderFilter?.(guard)}

      <EditableDataTable
        key={`${tableId}-${datasetKey}-${savedAt}`}
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
