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

describe("boolean fields", () => {
  const WITH_FLAG: TableColumn[] = [
    { key: "name", label: "Nombre", type: "text", required: true },
    { key: "in_fundraising", label: "En captación", type: "boolean" },
  ];

  it("render as a switch labelled by the column, not a bare checkbox", () => {
    renderDialog({ columns: WITH_FLAG, mode: "create" });

    expect(screen.getByRole("switch", { name: "En captación" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("start ON when the record is on, in either shape of the value", () => {
    renderDialog({
      columns: WITH_FLAG,
      mode: "edit",
      initialValues: { name: "A", in_fundraising: "true" },
    });

    expect(screen.getByRole("switch", { name: "En captación" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("start OFF for the string 'false'", () => {
    renderDialog({
      columns: WITH_FLAG,
      mode: "edit",
      initialValues: { name: "A", in_fundraising: "false" },
    });

    expect(screen.getByRole("switch", { name: "En captación" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
  });

  it("send 'false' when an ON record is switched off while editing", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog({
      columns: WITH_FLAG,
      mode: "edit",
      initialValues: { name: "A", in_fundraising: true },
    });

    await user.click(screen.getByRole("switch", { name: "En captación" }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ in_fundraising: "false" })
    );
  });

  it("send nothing for an untouched switch while editing", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog({
      columns: WITH_FLAG,
      mode: "edit",
      initialValues: { name: "A", in_fundraising: true },
    });

    const name = screen.getByLabelText("Nombre");
    await user.clear(name);
    await user.type(name, "B");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: "B" }));
  });

  it("send 'true' when switched on while creating", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog({ columns: WITH_FLAG, mode: "create" });

    await user.type(screen.getByLabelText("Nombre *"), "Nuevo");
    await user.click(screen.getByRole("switch", { name: "En captación" }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ name: "Nuevo", in_fundraising: "true" })
    );
  });
});

describe("return offer fields", () => {
  const t = es.returnOffer;
  const WITH_OFFER: TableColumn[] = [
    { key: "name", label: "Nombre", type: "text", required: true },
    { key: "return_offer", label: "Retorno ofrecido", type: "returnOffer" },
  ];
  const PARTICIPATION = { kind: "participation", percent: 8 };

  it("render the structured editor inline, starting from the record", () => {
    renderDialog({
      columns: WITH_OFFER,
      mode: "edit",
      initialValues: { name: "A", return_offer: PARTICIPATION },
    });

    expect(screen.getByLabelText(t.participationLabel)).toHaveValue("8");
  });

  it("send nothing for an untouched offer while editing", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog({
      columns: WITH_OFFER,
      mode: "edit",
      initialValues: { name: "A", return_offer: PARTICIPATION },
    });

    const name = screen.getByLabelText("Nombre");
    await user.clear(name);
    await user.type(name, "B");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: "B" }));
  });

  it("send the canonical offer when it changes", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog({
      columns: WITH_OFFER,
      mode: "edit",
      initialValues: { name: "A", return_offer: PARTICIPATION },
    });

    const input = screen.getByLabelText(t.participationLabel);
    await user.clear(input);
    await user.type(input, "10");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        return_offer: '{"kind":"participation","percent":10}',
      })
    );
  });

  it("send an empty value when the offer is withdrawn", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog({
      columns: WITH_OFFER,
      mode: "edit",
      initialValues: { name: "A", return_offer: PARTICIPATION },
    });

    await user.click(screen.getByRole("button", { name: t.kinds.none }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ return_offer: "" }));
  });

  it("block the submit while the offer is invalid, and say why", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog({
      columns: WITH_OFFER,
      mode: "edit",
      initialValues: { name: "A", return_offer: PARTICIPATION },
    });

    await user.clear(screen.getByLabelText(t.participationLabel));
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      t.errors.missingParticipation
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("send nothing for an offer left unpublished when creating", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog({ columns: WITH_OFFER, mode: "create" });

    await user.type(screen.getByLabelText("Nombre *"), "Nuevo");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: "Nuevo" }));
  });
});
