import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { es } from "@/i18n";
import type { TableColumn } from "@/lib/table/types";
import { RecordFormDialog } from "./RecordFormDialog";

const COLUMNS: TableColumn[] = [
  { key: "name", label: "Nombre", type: "text", required: true },
  { key: "city", label: "Ciudad", type: "select", options: ["Rotonda", "Otra"] },
  { key: "progress", label: "Avance", type: "percent" },
  // Never editable from a form either; the server refuses it anyway.
  { key: "status", label: "Estado", type: "select", options: ["activo"], readOnly: true },
];

const PROJECT = {
  id: "row-1",
  name: "Villa Rotonda",
  city: "Rotonda",
  progress: 40,
  status: "activo",
};

function renderDialog(props: Record<string, unknown> = {}) {
  const onSubmit = vi.fn().mockResolvedValue({ ok: true });
  const onOpenChange = vi.fn();

  render(
    <RecordFormDialog
      open
      onOpenChange={onOpenChange}
      title="Editar proyecto"
      columns={COLUMNS}
      submitLabel="Guardar"
      submittingLabel="Guardando…"
      onSubmit={onSubmit}
      {...props}
    />
  );

  return { onSubmit, onOpenChange };
}

describe("editing a record", () => {
  it("sends ONLY the fields that changed", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog({
      mode: "edit",
      initialValues: PROJECT,
    });

    const dialog = screen.getByRole("dialog");
    const name = within(dialog).getByLabelText("Nombre");
    await user.clear(name);
    await user.type(name, "Villa Norte");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ name: "Villa Norte" })
    );
  });

  it("starts from the record's current values", () => {
    renderDialog({ mode: "edit", initialValues: PROJECT });

    expect(screen.getByLabelText("Nombre")).toHaveValue("Villa Rotonda");
    expect(screen.getByLabelText("Avance")).toHaveValue(40);
  });

  it("leaves read-only columns out of the form", () => {
    renderDialog({ mode: "edit", initialValues: PROJECT });

    expect(screen.queryByLabelText("Estado")).not.toBeInTheDocument();
  });

  it("refuses to submit when nothing was touched", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog({ mode: "edit", initialValues: PROJECT });

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      es.validation.emptyBatch
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("keeps the dialog open and shows why when the server refuses", async () => {
    const user = userEvent.setup();
    const onSubmit = vi
      .fn()
      .mockResolvedValue({ ok: false, error: "Ciudad no válida" });
    const { onOpenChange } = renderDialog({
      mode: "edit",
      initialValues: PROJECT,
      onSubmit,
    });

    const name = screen.getByLabelText("Nombre");
    await user.clear(name);
    await user.type(name, "Villa Norte");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ciudad no válida"
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("does not freeze when the Server Action rejects", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error("network"));
    renderDialog({ mode: "edit", initialValues: PROJECT, onSubmit });

    const name = screen.getByLabelText("Nombre");
    await user.clear(name);
    await user.type(name, "Villa Norte");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      es.admin.saveError
    );
    // The submit control is usable again, not stuck on its loading label.
    expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();
  });
});

describe("creating a record", () => {
  it("blocks the round trip when a required field is empty", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog({ mode: "create" });

    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Nombre");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("sends only the fields that were filled", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog({ mode: "create" });

    await user.type(screen.getByLabelText("Nombre *"), "Proyecto nuevo");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ name: "Proyecto nuevo" })
    );
  });
});
