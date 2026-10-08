import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { es } from "@/i18n";
import type { TableChanges, TableColumn, TableRow } from "@/lib/table/types";

const refresh = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push }),
  usePathname: () => "/admin",
}));

const { BatchEditPanel } = await import("./BatchEditPanel");

const COLUMNS: TableColumn[] = [
  { key: "name", label: "Nombre", type: "text", required: true },
  { key: "status", label: "Estado", type: "select", options: ["activo", "pausado"] },
];

const ROWS: TableRow[] = [
  { id: "row-1", name: "Villa Rotonda", status: "activo" },
  { id: "row-2", name: "Lote 7", status: "pausado" },
];

function renderPanel(
  onSave: (changes: TableChanges) => Promise<{ ok: boolean; error?: string }>,
  props: Record<string, unknown> = {}
) {
  return render(
    <BatchEditPanel
      tableId="proyectos"
      datasetKey="proyectos"
      columns={COLUMNS}
      rows={ROWS}
      allowInsert
      onSave={onSave}
      {...props}
    />
  );
}

/** Opens a cell for editing the way the grid does it, and types a new value. */
async function editCell(
  user: ReturnType<typeof userEvent.setup>,
  currentValue: string,
  nextValue: string
) {
  await user.dblClick(screen.getByText(currentValue));
  const input = screen.getByDisplayValue(currentValue);
  await user.clear(input);
  await user.type(input, nextValue);
  // Blur commits, exactly as it does for a real admin moving on.
  await user.tab();
}

beforeEach(() => {
  refresh.mockClear();
  push.mockClear();
});

describe("autosave", () => {
  it("saves a committed cell without anyone pressing a button", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue({ ok: true });

    renderPanel(onSave);
    await editCell(user, "Villa Rotonda", "Villa Norte");

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        updates: [{ id: "row-1", values: { name: "Villa Norte" } }],
        inserts: [],
      })
    );

    // And the screen says so, rather than leaving the admin guessing.
    expect(await screen.findByText(es.admin.autosaveSaved)).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("sends the cells of one row as a single batch", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue({ ok: true });

    renderPanel(onSave);
    await editCell(user, "Villa Rotonda", "Villa Norte");
    await editCell(user, "Lote 7", "Lote 9");

    await waitFor(() => expect(onSave).toHaveBeenCalled());

    // Both edits reach the server; how they are grouped depends on the
    // debounce, but nothing may be dropped.
    const sent = onSave.mock.calls.flatMap(
      (call) => (call[0] as TableChanges).updates
    );
    expect(sent).toEqual(
      expect.arrayContaining([
        { id: "row-1", values: { name: "Villa Norte" } },
        { id: "row-2", values: { name: "Lote 9" } },
      ])
    );
  });

  it("keeps the edit on screen and offers a retry when the save is refused", async () => {
    const user = userEvent.setup();
    const onSave = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: "No se pudo" })
      .mockResolvedValue({ ok: true });

    renderPanel(onSave);
    await editCell(user, "Villa Rotonda", "Villa Norte");

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo");
    // The value the admin typed is still there — it was not rolled back.
    expect(screen.getByText("Villa Norte")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: es.admin.retry }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(onSave).toHaveBeenLastCalledWith({
      updates: [{ id: "row-1", values: { name: "Villa Norte" } }],
      inserts: [],
    });
  });

  it("survives a Server Action that rejects outright", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error("network"));

    renderPanel(onSave);
    await editCell(user, "Villa Rotonda", "Villa Norte");

    // A rejection must land as a message, never as a spinner that never ends.
    expect(await screen.findByRole("alert")).toHaveTextContent(
      es.admin.saveError
    );
    expect(
      screen.getByRole("button", { name: es.admin.retry })
    ).toBeInTheDocument();
  });

  it("flushes pending edits BEFORE a navigation, so a tab change never loses them", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    const navigate = vi.fn();

    renderPanel(onSave, {
      renderFilter: ({ guard }: { guard: (go: () => void) => void }) => (
        <button type="button" onClick={() => guard(navigate)}>
          Cambiar de tabla
        </button>
      ),
    });

    await editCell(user, "Villa Rotonda", "Villa Norte");
    await user.click(screen.getByRole("button", { name: "Cambiar de tabla" }));

    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith({
      updates: [{ id: "row-1", values: { name: "Villa Norte" } }],
      inserts: [],
    });
    // The save happened first; the navigation only ran afterwards.
    expect(onSave.mock.invocationCallOrder[0]).toBeLessThan(
      navigate.mock.invocationCallOrder[0]
    );
  });
});

describe("edits that arrive at awkward moments", () => {
  it("coalesces two edits of the same cell into the last value", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue({ ok: true });

    renderPanel(onSave);
    await editCell(user, "Villa Rotonda", "Primera");
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    onSave.mockClear();

    await editCell(user, "Primera", "Definitiva");

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const sent = onSave.mock.calls.flatMap(
      (call) => (call[0] as TableChanges).updates
    );
    expect(sent).toEqual([{ id: "row-1", values: { name: "Definitiva" } }]);
  });

  it("does not lose an edit made while a save is still in flight", async () => {
    const user = userEvent.setup();
    const pending: { release?: () => void } = {};
    const onSave = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          pending.release = () => resolve({ ok: true });
        })
    );

    renderPanel(onSave);
    await editCell(user, "Villa Rotonda", "Villa Norte");
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    // The first save has not answered yet; a second row is edited meanwhile.
    await editCell(user, "Lote 7", "Lote 9");
    pending.release?.();

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(onSave).toHaveBeenLastCalledWith({
      updates: [{ id: "row-2", values: { name: "Lote 9" } }],
      inserts: [],
    });
  });

  it("retries with the NEWER value when the cell was corrected after a failure", async () => {
    const user = userEvent.setup();
    const onSave = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: "No se pudo" })
      .mockResolvedValue({ ok: true });

    renderPanel(onSave);
    await editCell(user, "Villa Rotonda", "Mal escrito");
    await screen.findByRole("alert");

    await editCell(user, "Mal escrito", "Bien escrito");

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(onSave).toHaveBeenLastCalledWith({
      updates: [{ id: "row-1", values: { name: "Bien escrito" } }],
      inserts: [],
    });
  });

  it("asks before leaving when the save keeps failing, and stays put on 'cancel'", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue({ ok: false, error: "No se pudo" });
    const navigate = vi.fn();
    const confirm = vi
      .spyOn(window, "confirm")
      .mockReturnValue(false);

    renderPanel(onSave, {
      renderFilter: ({ guard }: { guard: (go: () => void) => void }) => (
        <button type="button" onClick={() => guard(navigate)}>
          Cambiar de tabla
        </button>
      ),
    });

    await editCell(user, "Villa Rotonda", "Villa Norte");
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "Cambiar de tabla" }));

    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(navigate).not.toHaveBeenCalled();
    // The edit is still there to be retried.
    expect(screen.getByText("Villa Norte")).toBeInTheDocument();

    confirm.mockRestore();
  });

  it("never asks when everything saved", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    const navigate = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);

    renderPanel(onSave, {
      renderFilter: ({ guard }: { guard: (go: () => void) => void }) => (
        <button type="button" onClick={() => guard(navigate)}>
          Cambiar de tabla
        </button>
      ),
    });

    await editCell(user, "Villa Rotonda", "Villa Norte");
    await user.click(screen.getByRole("button", { name: "Cambiar de tabla" }));

    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(confirm).not.toHaveBeenCalled();

    confirm.mockRestore();
  });

  it("fires the pending batch when the screen is left mid-edit", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue({ ok: true });

    const { unmount } = renderPanel(onSave);
    await user.dblClick(screen.getByText("Villa Rotonda"));
    const input = screen.getByDisplayValue("Villa Rotonda");
    await user.clear(input);
    await user.type(input, "Villa Norte");
    await user.tab();

    // Navigating away with the sidebar unmounts the panel without a guard.
    unmount();

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        updates: [{ id: "row-1", values: { name: "Villa Norte" } }],
        inserts: [],
      })
    );
  });
});

describe("editing a whole record", () => {
  it("opens the record in a form and saves only what changed", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue({ ok: true });

    renderPanel(onSave);

    // One "Editar" per row; the first belongs to the first record.
    await user.click(
      screen.getAllByRole("button", { name: es.admin.editRecord })[0]
    );

    const dialog = await screen.findByRole("dialog");
    const name = within(dialog).getByLabelText("Nombre");
    await user.clear(name);
    await user.type(name, "Villa Norte");
    await user.click(
      within(dialog).getByRole("button", { name: es.admin.saveChanges })
    );

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        updates: [{ id: "row-1", values: { name: "Villa Norte" } }],
        inserts: [],
      })
    );
  });
});

describe("creating a record", () => {
  it("creates from a form instead of a row at the end of the table", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue({ ok: true });

    renderPanel(onSave);

    await user.click(screen.getByRole("button", { name: es.admin.newRecord }));

    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nombre *"), "Proyecto nuevo");
    await user.click(
      screen.getByRole("button", { name: es.admin.createRecord })
    );

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        updates: [],
        inserts: [{ name: "Proyecto nuevo" }],
      })
    );
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it("does not offer the form when the table refuses inserts", () => {
    renderPanel(vi.fn(), { allowInsert: false });

    expect(
      screen.queryByRole("button", { name: es.admin.newRecord })
    ).not.toBeInTheDocument();
  });
});

describe("deleting a row", () => {
  const d = es.admin.delete;

  it("offers no bin when the screen does not allow deleting", () => {
    renderPanel(vi.fn());

    expect(
      screen.queryByRole("button", { name: d.open.replace("{n}", "1") })
    ).not.toBeInTheDocument();
  });

  it("asks before deleting, and says what the deletion affects", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue({ ok: true });
    renderPanel(vi.fn(), { onDelete, deleteWarning: "Las cifras se recalculan." });

    await user.click(screen.getByRole("button", { name: d.open.replace("{n}", "1") }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Las cifras se recalculan.")).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("deletes the row it was opened from", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue({ ok: true });
    renderPanel(vi.fn(), { onDelete });

    await user.click(screen.getByRole("button", { name: d.open.replace("{n}", "2") }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: d.confirm }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("row-2"));
    expect(refresh).toHaveBeenCalled();
  });

  it("saves pending edits before deleting, so nothing in flight is lost", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    const onDelete = vi.fn().mockResolvedValue({ ok: true });
    renderPanel(onSave, { onDelete });

    await editCell(user, "Villa Rotonda", "Villa Norte");
    await user.click(screen.getByRole("button", { name: d.open.replace("{n}", "2") }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: d.confirm }));

    await waitFor(() => expect(onDelete).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith({
      updates: [{ id: "row-1", values: { name: "Villa Norte" } }],
      inserts: [],
    });
    expect(onSave.mock.invocationCallOrder[0]).toBeLessThan(
      onDelete.mock.invocationCallOrder[0]
    );
  });

  it("keeps the dialog open with the reason when the server refuses", async () => {
    const user = userEvent.setup();
    const onDelete = vi
      .fn()
      .mockResolvedValue({ ok: false, error: d.approvedRequest });
    renderPanel(vi.fn(), { onDelete });

    await user.click(screen.getByRole("button", { name: d.open.replace("{n}", "1") }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: d.confirm }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(d.approvedRequest);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not freeze when the action rejects", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockRejectedValue(new Error("network"));
    renderPanel(vi.fn(), { onDelete });

    await user.click(screen.getByRole("button", { name: d.open.replace("{n}", "1") }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: d.confirm }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(d.failed);
  });

  it("hides the bin on rows that may not be deleted", () => {
    const onDelete = vi.fn();
    renderPanel(vi.fn(), {
      onDelete,
      // The screen decides per row: an approved request keeps no bin.
      canDeleteRow: (row: TableRow) => row.id !== "row-1",
    });

    expect(
      screen.queryByRole("button", { name: d.open.replace("{n}", "1") })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: d.open.replace("{n}", "2") })
    ).toBeInTheDocument();
  });
});
