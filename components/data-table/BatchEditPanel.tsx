"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  CircleAlertIcon,
  CircleCheckIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
} from "lucide-react";
import { es } from "@/i18n";
import {
  hasPending,
  mergeUpdate,
  restoreUpdates,
  toTableChanges,
  type PendingUpdates,
} from "@/lib/table/pending-changes";
import type { TableChanges, TableColumn, TableRow } from "@/lib/table/types";
import { Button } from "@/components/ui/button";
import {
  EditableDataTable,
  type EditableDataTableProps,
} from "./EditableDataTable";
import { RecordFormDialog } from "./RecordFormDialog";

/**
 * How long a commit waits for its neighbours before the batch leaves.
 *
 * Short enough that a distracted admin never has unsaved work on screen for
 * long, long enough that filling three cells of one row is one request and one
 * transaction rather than three.
 */
const AUTOSAVE_DELAY_MS = 800;

/**
 * Runs a navigation only after the autosave buffer has been flushed.
 *
 * It used to ask the admin whether to throw their edits away. Now there is
 * nothing to throw away: the pending batch is saved first and the navigation
 * happens after.
 */
export type NavigationGuard = (navigate: () => void) => void;

/** What a screen gets to place inside its own filter row. */
export type FilterSlotProps = {
  guard: NavigationGuard;
  /** The "new record" control, or null when the table does not accept inserts. */
  createButton: ReactNode;
};

export type BatchEditPanelProps = {
  /** Admin table id handed to the save action. */
  tableId: string;
  columns: TableColumn[];
  rows: TableRow[];
  allowInsert: boolean;
  /** Changing this remounts the grid, clearing any local cell state. */
  datasetKey: string;
  /** Filter control (tabs, dropdowns…). Receives the guard and the + button. */
  renderFilter?: (slot: FilterSlotProps) => ReactNode;
  /** Optional trailing action column; passed straight to the grid. */
  rowAction?: EditableDataTableProps["rowAction"];
  /** Title of the creation dialog. Defaults to a generic one. */
  createTitle?: string;
  createDescription?: string;
  emptyMessage?: string;
  /**
   * Persists a batch. Injected so each screen can adapt the payload before
   * sending it, while the buffer → debounce → save → retry flow stays here.
   */
  onSave: (changes: TableChanges) => Promise<{ ok: boolean; error?: string }>;
};

/**
 * Shared shell for every editable-table screen: grid, AUTOSAVE, creation
 * dialog and save status.
 *
 * Why autosave: edits used to sit in the browser until someone pressed
 * "Guardar cambios". Switching tabs, following a link or closing the tab threw
 * them away — and the confirm dialog that warned about it was the only thing
 * standing between an afternoon of corrections and nothing. Every committed
 * cell now goes to the server on its own, within a second, and the only state
 * the client holds is a batch in flight.
 *
 * What did NOT change is the write itself: the same action, the same
 * validation and the same all-or-nothing SQL function. A batch is smaller now
 * (usually one row), which makes the transaction cheaper, not weaker.
 *
 * The admin panel and the sales funnel differ only in their filter control and
 * in how the payload is prepared, so both pass those in.
 */
export function BatchEditPanel({
  tableId,
  columns,
  rows,
  allowInsert,
  datasetKey,
  renderFilter,
  rowAction,
  createTitle,
  createDescription,
  emptyMessage,
  onSave,
}: BatchEditPanelProps) {
  const router = useRouter();

  /** Cells committed but not yet confirmed by the server. */
  const pendingRef = useRef<PendingUpdates>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The save currently in flight, so two never overlap on the same rows. */
  const inFlightRef = useRef<Promise<void> | null>(null);
  /**
   * `flush` must be STABLE: the effect that fires the pending batch on unmount
   * depends on it, so anything that changes its identity re-runs that effect —
   * cleanup included — and fires the batch again mid-session. Both moving
   * parts therefore travel by ref: `onSave` is an inline arrow in every caller,
   * and a router object is not guaranteed to be the same one between renders.
   */
  const onSaveRef = useRef(onSave);
  const routerRef = useRef(router);
  useEffect(() => {
    onSaveRef.current = onSave;
    routerRef.current = router;
  });

  const [status, setStatus] = useState<
    "idle" | "pending" | "saving" | "saved" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [pendingRowIds, setPendingRowIds] = useState<string[]>([]);
  const [errorRowIds, setErrorRowIds] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  /** The record open in the edit form, if any. */
  const [editingRow, setEditingRow] = useState<TableRow | null>(null);
  /**
   * Bumped after a write that did NOT come from the grid, to remount it.
   *
   * The grid keeps every value it committed on screen until the server
   * confirms it. Edit the same field afterwards through the row form and those
   * two disagree — the grid would go on showing what was typed into the cell,
   * over a record that now says something else. Remounting drops the overlay
   * and the fresh rows are what is rendered. Nothing is lost: it only happens
   * after a save that succeeded.
   */
  const [revision, setRevision] = useState(0);

  const flush = useCallback(async (): Promise<void> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Serialised on purpose: two batches touching the same row must not race,
    // and the second one must see whether the first succeeded.
    if (inFlightRef.current) await inFlightRef.current;

    const batch = pendingRef.current;
    if (!hasPending(batch)) return;

    pendingRef.current = {};
    setStatus("saving");

    const run = (async () => {
      try {
        const result = await onSaveRef.current(toTableChanges(batch));

        if (!result.ok) {
          pendingRef.current = restoreUpdates(pendingRef.current, batch);
          setErrorRowIds(Object.keys(batch));
          setError(result.error ?? es.admin.saveError);
          setStatus("error");
          return;
        }

        const savedIds = new Set(Object.keys(batch));
        setErrorRowIds((current) => current.filter((id) => !savedIds.has(id)));
        setError(null);
        setStatus(hasPending(pendingRef.current) ? "pending" : "saved");
        routerRef.current.refresh();
      } catch {
        // A rejected Server Action — the request never made it, or the answer
        // never came back. The batch goes back in the buffer so "Reintentar"
        // has something to retry, and the edit stays visible on screen.
        pendingRef.current = restoreUpdates(pendingRef.current, batch);
        setErrorRowIds(Object.keys(batch));
        setError(es.admin.saveError);
        setStatus("error");
      } finally {
        setPendingRowIds(Object.keys(pendingRef.current));
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = run;
    await run;
  }, []);

  function handleCellCommit(rowId: string, columnKey: string, value: string) {
    pendingRef.current = mergeUpdate(pendingRef.current, rowId, columnKey, value);
    setPendingRowIds(Object.keys(pendingRef.current));
    setStatus("pending");

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
  }

  // Last resort for a full page unload: the buffer lives at most a second, but
  // a reload timed inside that second would still lose it.
  const isBusy = status === "pending" || status === "saving" || status === "error";
  useEffect(() => {
    if (!isBusy) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isBusy]);

  // Navigating away with the sidebar unmounts this without going through the
  // guard: firing the pending batch here means the request is already on its
  // way by the time the next screen renders.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (hasPending(pendingRef.current)) void flush();
    };
  }, [flush]);

  /**
   * Navigate, but only after the buffer is empty.
   *
   * Normally the flush succeeds and the navigation follows with nothing lost —
   * which is the whole point of autosaving. The confirm is for the one case
   * where it does not: a save that keeps being refused leaves the batch in the
   * buffer, and leaving the screen then WOULD throw work away. Asking is the
   * only honest thing to do, and it never appears when everything saved.
   */
  const guard = useCallback<NavigationGuard>(
    (navigate) => {
      void flush().then(() => {
        if (
          hasPending(pendingRef.current) &&
          !window.confirm(es.admin.discardConfirm)
        ) {
          return;
        }
        navigate();
      });
    },
    [flush]
  );

  async function createRecord(values: Record<string, string>) {
    // Anything typed into the grid goes first, so the refresh that follows the
    // insert cannot arrive before it.
    await flush();

    const result = await onSaveRef.current({ updates: [], inserts: [values] });
    if (result.ok) {
      setStatus("saved");
      setError(null);
      setRevision((current) => current + 1);
      routerRef.current.refresh();
    }
    return result;
  }

  /**
   * Every row carries its own "Editar", beside whatever the screen adds.
   *
   * Cell editing is right for a correction — one value, seen in context. It is
   * the wrong shape for filling in a record with twenty columns, which meant
   * scrolling sideways and opening cell after cell with the labels long gone
   * off screen. The form shows the whole record at once, and writes through
   * exactly the same save.
   */
  const rowActions: EditableDataTableProps["rowAction"] = {
    label: es.admin.actionsColumn,
    width: (rowAction?.width ?? 0) + 120,
    render: (row) => (
      <div className="flex items-center gap-2">
        {/* Same rule as the cells: no id, no way to address the record. */}
        {row.id ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setEditingRow(row)}
          >
            <PencilIcon data-icon="inline-start" aria-hidden="true" />
            {es.admin.editRecord}
          </Button>
        ) : null}
        {rowAction?.render(row)}
      </div>
    ),
  };

  /** Saves the edit form of one existing record, through the same batch save. */
  async function updateRecord(values: Record<string, string>) {
    if (!editingRow) return { ok: false, error: es.admin.saveError };

    // Anything still buffered goes first, so the two writes cannot land in the
    // wrong order on the same row.
    await flush();

    const result = await onSaveRef.current({
      updates: [{ id: String(editingRow.id), values }],
      inserts: [],
    });

    if (result.ok) {
      setStatus("saved");
      setError(null);
      setRevision((current) => current + 1);
      routerRef.current.refresh();
    }
    return result;
  }

  const createButton = allowInsert ? (
    <Button
      type="button"
      variant="brand"
      size="lg"
      onClick={() => setIsCreating(true)}
    >
      <PlusIcon data-icon="inline-start" aria-hidden="true" />
      {es.admin.newRecord}
    </Button>
  ) : null;

  return (
    <div className="flex flex-col gap-4">
      {renderFilter ? (
        <FilterSlot render={renderFilter} guard={guard} createButton={createButton} />
      ) : createButton ? (
        <div className="flex justify-end">{createButton}</div>
      ) : null}

      <EditableDataTable
        key={`${tableId}-${datasetKey}-${revision}`}
        columns={columns}
        rows={rows}
        onCellCommit={handleCellCommit}
        pendingRowIds={pendingRowIds}
        errorRowIds={errorRowIds}
        rowAction={rowActions}
        emptyMessage={emptyMessage}
      />

      {/* Save status. It sits under the grid, is never a blocking control, and
          says the same three things every time: saving, saved, or failed. */}
      <div className="flex min-h-9 flex-wrap items-center gap-3">
        {status === "pending" || status === "saving" ? (
          <p className="flex items-center gap-2 text-sm text-ink-500">
            <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
            {es.admin.saving}
          </p>
        ) : null}

        {status === "saved" ? (
          <p className="flex items-center gap-2 text-sm text-ink-500">
            <CircleCheckIcon className="size-4" aria-hidden="true" />
            {es.admin.autosaveSaved}
          </p>
        ) : null}

        {status === "idle" ? (
          <p className="text-sm text-ink-400">{es.admin.autosaveHint}</p>
        ) : null}

        {status === "error" ? (
          <>
            <p
              role="alert"
              className="flex items-center gap-2 text-sm text-destructive"
            >
              <CircleAlertIcon className="size-4 shrink-0" aria-hidden="true" />
              {error ?? es.admin.saveError}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void flush()}
            >
              {es.admin.retry}
            </Button>
          </>
        ) : null}
      </div>

      {editingRow ? (
        <RecordFormDialog
          // A fresh form per record.
          key={`edit-${String(editingRow.id)}`}
          open
          onOpenChange={(open) => {
            if (!open) setEditingRow(null);
          }}
          title={es.admin.editRecordTitle}
          description={es.admin.editRecordHint}
          columns={columns}
          initialValues={editingRow}
          mode="edit"
          submitLabel={es.admin.saveChanges}
          submittingLabel={es.admin.saving}
          onSubmit={updateRecord}
        />
      ) : null}

      {isCreating ? (
        <RecordFormDialog
          // A fresh form every time it opens.
          key={`create-${datasetKey}`}
          open
          onOpenChange={setIsCreating}
          title={createTitle ?? es.admin.newRecord}
          description={createDescription ?? es.admin.newRecordHint}
          columns={columns}
          mode="create"
          submitLabel={es.admin.createRecord}
          submittingLabel={es.admin.creating}
          onSubmit={createRecord}
        />
      ) : null}
    </div>
  );
}

/**
 * Renders the screen's own filter control.
 *
 * A component rather than calling `renderFilter(...)` inline: `guard` closes
 * over the autosave buffer, and handing it to a function DURING RENDER reads
 * as "this may be invoked while rendering" — which it must never be. As a prop
 * it is what it actually is: a callback for an event handler further down.
 */
function FilterSlot({
  render,
  guard,
  createButton,
}: {
  render: (slot: FilterSlotProps) => ReactNode;
  guard: NavigationGuard;
  createButton: ReactNode;
}) {
  return <>{render({ guard, createButton })}</>;
}
