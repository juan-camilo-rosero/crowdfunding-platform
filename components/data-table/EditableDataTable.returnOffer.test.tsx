import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { es } from "@/i18n";
import { serializeReturnOffer } from "@/lib/projects/return-offer";
import type { TableColumn, TableRow } from "@/lib/table/types";
import { EditableDataTable } from "./EditableDataTable";

const t = es.returnOffer;

const COLUMNS: TableColumn[] = [
  { key: "name", label: "Nombre", type: "text" },
  {
    key: "return_offer",
    label: "Retorno ofrecido",
    type: "returnOffer",
    fallback: "offered_return",
  },
];

function renderGrid(rows: TableRow[], columns: TableColumn[] = COLUMNS) {
  const onCellCommit = vi.fn();
  render(<EditableDataTable columns={columns} rows={rows} onCellCommit={onCellCommit} />);
  return { onCellCommit };
}

const openEditor = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: new RegExp(t.edit) }));

describe("reading the return offer in the grid", () => {
  it("shows the offer's label, not JSON", () => {
    renderGrid([
      { id: "a", name: "A", return_offer: { kind: "participation", percent: 8 } },
    ]);

    expect(screen.getByText("8% de participación en utilidades")).toBeInTheDocument();
  });

  it("shows the legacy text, muted, while no offer is configured", () => {
    renderGrid([
      { id: "a", name: "A", return_offer: null, offered_return: "Hasta 15% anual" },
    ]);

    expect(
      screen.getByText(t.legacy.replace("{text}", "Hasta 15% anual"))
    ).toBeInTheDocument();
  });

  it("prefers the offer over the legacy text", () => {
    renderGrid([
      {
        id: "a",
        name: "A",
        return_offer: { kind: "participation", percent: 8 },
        offered_return: "Hasta 15% anual",
      },
    ]);

    expect(screen.queryByText(/Hasta 15% anual/)).not.toBeInTheDocument();
  });
});

describe("editing the return offer from the grid", () => {
  it("opens the editor on the current offer", async () => {
    const user = userEvent.setup();
    renderGrid([
      { id: "a", name: "A", return_offer: { kind: "participation", percent: 8 } },
    ]);

    await openEditor(user);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(t.participationLabel)).toHaveValue("8");
  });

  it("commits the canonical offer on save and closes", async () => {
    const user = userEvent.setup();
    const { onCellCommit } = renderGrid([{ id: "a", name: "A", return_offer: null }]);

    await openEditor(user);
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: t.kinds.total }));
    await user.type(within(dialog).getByLabelText(t.totalMin), "20");
    await user.click(within(dialog).getByRole("button", { name: t.save }));

    expect(onCellCommit).toHaveBeenCalledWith(
      "a",
      "return_offer",
      serializeReturnOffer({ kind: "total", min: 20, max: 20, months: null })
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("20% al cierre")).toBeInTheDocument();
  });

  it("commits an empty value when the offer is withdrawn", async () => {
    const user = userEvent.setup();
    const { onCellCommit } = renderGrid([
      { id: "a", name: "A", return_offer: { kind: "participation", percent: 8 } },
    ]);

    await openEditor(user);
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: t.kinds.none }));
    await user.click(within(dialog).getByRole("button", { name: t.save }));

    expect(onCellCommit).toHaveBeenCalledWith("a", "return_offer", "");
  });

  it("keeps the dialog open and commits nothing while the offer is invalid", async () => {
    const user = userEvent.setup();
    const { onCellCommit } = renderGrid([{ id: "a", name: "A", return_offer: null }]);

    await openEditor(user);
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: t.kinds.participation }));
    await user.click(within(dialog).getByRole("button", { name: t.save }));

    expect(onCellCommit).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(within(dialog).getAllByText(t.errors.missingParticipation).length).toBeGreaterThan(0);
  });

  it("commits nothing when saved unchanged", async () => {
    const user = userEvent.setup();
    const { onCellCommit } = renderGrid([
      { id: "a", name: "A", return_offer: { kind: "participation", percent: 8 } },
    ]);

    await openEditor(user);
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: t.save }));

    expect(onCellCommit).not.toHaveBeenCalled();
  });

  it("discards the draft on cancel", async () => {
    const user = userEvent.setup();
    const { onCellCommit } = renderGrid([
      { id: "a", name: "A", return_offer: { kind: "participation", percent: 8 } },
    ]);

    await openEditor(user);
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByLabelText(t.participationLabel);
    await user.clear(input);
    await user.type(input, "30");
    await user.click(within(dialog).getByRole("button", { name: t.cancel }));

    expect(onCellCommit).not.toHaveBeenCalled();
    expect(screen.getByText("8% de participación en utilidades")).toBeInTheDocument();
  });

  it("offers no editor on a read-only column", () => {
    renderGrid(
      [{ id: "a", name: "A", return_offer: null }],
      [
        { key: "name", label: "Nombre", type: "text" },
        { key: "return_offer", label: "Retorno ofrecido", type: "returnOffer", readOnly: true },
      ]
    );

    expect(screen.queryByRole("button", { name: new RegExp(t.edit) })).not.toBeInTheDocument();
  });
});
