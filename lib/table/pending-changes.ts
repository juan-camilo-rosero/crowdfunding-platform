import type { TableChanges } from "./types";

/**
 * The buffer that sits between a cell commit and the server.
 *
 * Autosave does NOT send one request per keystroke: commits land here first,
 * grouped by row, and a short debounce later the whole buffer leaves as ONE
 * batch. Two edits to the same cell collapse into the last value, and two
 * edits to different cells of the same row travel together — which matters
 * because the save is all-or-nothing per batch (admin_save_table_changes runs
 * in a single transaction).
 *
 * Pure on purpose: no React, no timers. The panel owns the timing, this owns
 * the shape.
 */
export type PendingUpdates = Record<string, Record<string, string>>;

/** Adds one committed cell to the buffer, returning a new buffer. */
export function mergeUpdate(
  pending: PendingUpdates,
  rowId: string,
  columnKey: string,
  value: string
): PendingUpdates {
  return {
    ...pending,
    [rowId]: { ...(pending[rowId] ?? {}), [columnKey]: value },
  };
}

/**
 * Puts a batch back after a failed save, WITHOUT overwriting anything typed
 * while it was in flight — the newer value is the one the admin can still see
 * on screen, so it wins.
 */
export function restoreUpdates(
  pending: PendingUpdates,
  failed: PendingUpdates
): PendingUpdates {
  const merged: PendingUpdates = { ...pending };

  for (const [rowId, values] of Object.entries(failed)) {
    merged[rowId] = { ...values, ...(pending[rowId] ?? {}) };
  }

  return merged;
}

/** Cells waiting to be saved. Counts cells, not rows: it is what the UI says. */
export function countPending(pending: PendingUpdates): number {
  return Object.values(pending).reduce(
    (total, values) => total + Object.keys(values).length,
    0
  );
}

export function hasPending(pending: PendingUpdates): boolean {
  return countPending(pending) > 0;
}

/** Shapes the buffer as the save action expects it. */
export function toTableChanges(pending: PendingUpdates): TableChanges {
  return {
    updates: Object.entries(pending)
      .filter(([, values]) => Object.keys(values).length > 0)
      .map(([id, values]) => ({ id, values })),
    inserts: [],
  };
}
