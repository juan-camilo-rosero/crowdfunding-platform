"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, startTransition } from "react";
import { CircleAlertIcon, CircleCheckIcon, ChevronDownIcon, FilterIcon } from "lucide-react";
import { es } from "@/i18n";
import { optionLabel, optionValue, type TableChanges, type TableColumn, type TableRow, type SelectOption } from "@/lib/table/types";
import { Button } from "@/components/ui/button";
import { EditableDataTable } from "@/components/data-table/EditableDataTable";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { saveTableChanges } from "../actions";

const NO_CHANGES: TableChanges = { updates: [], inserts: [] };

export type PipelinePanelProps = {
  activeStatus: string;
  statusOptions: readonly SelectOption[];
  columns: TableColumn[];
  rows: TableRow[];
  allowInsert: boolean;
};

export function PipelinePanel({
  activeStatus,
  statusOptions,
  columns,
  rows,
  allowInsert,
}: PipelinePanelProps) {
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();
  const [changes, setChanges] = useState<TableChanges>(NO_CHANGES);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState(0);

  const pendingCount = changes.updates.length + changes.inserts.length;
  const hasChanges = pendingCount > 0;

  useEffect(() => {
    if (!hasChanges) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasChanges]);

  function changeStatus(newStatus: string) {
    if (hasChanges && !window.confirm(es.admin.discardConfirm)) return;
    setChanges(NO_CHANGES);
    setError(null);
    router.push(`/admin/pipeline?estado=${newStatus}`);
  }

  function save() {
    setError(null);
    startSaving(async () => {
      // Inyectamos el estado actual a los nuevos registros creados si no lo llenaron
      const changesWithStatus: TableChanges = {
        updates: changes.updates,
        inserts: changes.inserts.map((insert) => {
          if (insert.status) return insert;
          if (activeStatus !== "todos") return { ...insert, status: activeStatus };
          return insert;
        }),
      };

      const result = await saveTableChanges("inversionistas", changesWithStatus);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      startTransition(() => {
        setChanges(NO_CHANGES);
        setSavedAt((count) => count + 1);
        router.refresh();
      });
    });
  }

  const activeLabel = activeStatus === "todos"
    ? "Todos los inversionistas"
    : optionLabel(statusOptions.find(o => optionValue(o) === activeStatus) || activeStatus);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex w-full items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex h-11.5 w-max min-w-48 cursor-pointer items-center justify-between gap-3 rounded-[10px] border border-line bg-elevated px-4 py-2 text-base font-normal text-ink-700 outline-none hover:bg-surface"
          >
            <div className="flex items-center gap-2">
              <FilterIcon className="size-4 text-ink-500" aria-hidden="true" />
              <span>{activeLabel}</span>
            </div>
            <ChevronDownIcon className="size-4 shrink-0 text-ink-500" aria-hidden="true" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onClick={() => changeStatus("todos")}>
              Todos los inversionistas
            </DropdownMenuItem>
            {statusOptions.map((opt) => (
              <DropdownMenuItem
                key={optionValue(opt)}
                onClick={() => changeStatus(optionValue(opt))}
              >
                {optionLabel(opt)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <EditableDataTable
        key={`${activeStatus}-${savedAt}`}
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
