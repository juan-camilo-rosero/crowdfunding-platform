import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TableColumn, TableRow } from "@/lib/table/types";
import { EditableDataTable } from "./EditableDataTable";

const COLUMNS: TableColumn[] = [
  { key: "name", label: "Nombre", type: "text" },
  { key: "amount", label: "Monto", type: "currency" },
  { key: "status", label: "Estado", type: "select", options: ["activo"], readOnly: true },
  { key: "notes", label: "Notas", type: "longText" },
];

const ROWS: TableRow[] = [
  { id: "row-1", name: "Villa Rotonda", amount: 140926, status: "activo", notes: null },
];

function renderGrid(props: Record<string, unknown> = {}) {
  const onCellCommit = vi.fn();
  render(
    <EditableDataTable
      columns={COLUMNS}
      rows={ROWS}
      onCellCommit={onCellCommit}
      {...props}
    />
  );
  return { onCellCommit };
}

describe("committing a cell", () => {
  it("reports the commit as soon as the cell is left", async () => {
    const user = userEvent.setup();
    const { onCellCommit } = renderGrid();

    await user.dblClick(screen.getByText("Villa Rotonda"));
    const input = screen.getByDisplayValue("Villa Rotonda");
    await user.clear(input);
    await user.type(input, "Villa Norte");
    await user.tab();

    expect(onCellCommit).toHaveBeenCalledWith("row-1", "name", "Villa Norte");
  });

  it("says nothing when the value was not actually changed", async () => {
    const user = userEvent.setup();
    const { onCellCommit } = renderGrid();

    await user.dblClick(screen.getByText("Villa Rotonda"));
    await user.tab();

    expect(onCellCommit).not.toHaveBeenCalled();
  });

  it("commits an emptied cell, which is how a value is cleared", async () => {
    const user = userEvent.setup();
    const { onCellCommit } = renderGrid();

    await user.dblClick(screen.getByText("Villa Rotonda"));
    await user.clear(screen.getByDisplayValue("Villa Rotonda"));
    await user.tab();

    expect(onCellCommit).toHaveBeenCalledWith("row-1", "name", "");
  });

  it("discards the edit on Escape", async () => {
    const user = userEvent.setup();
    const { onCellCommit } = renderGrid();

    await user.dblClick(screen.getByText("Villa Rotonda"));
    await user.type(screen.getByDisplayValue("Villa Rotonda"), "X{Escape}");

    expect(onCellCommit).not.toHaveBeenCalled();
    expect(screen.getByText("Villa Rotonda")).toBeInTheDocument();
  });

  it("opens with Enter on the focused cell, not only with a double click", async () => {
    const user = userEvent.setup();
    renderGrid();

    const cell = screen.getByText("Villa Rotonda").closest("[role='button']");
    (cell as HTMLElement).focus();
    await user.keyboard("{Enter}");

    expect(screen.getByDisplayValue("Villa Rotonda")).toBeInTheDocument();
  });

  it("keeps the value on screen after committing, before any refresh", async () => {
    const user = userEvent.setup();
    renderGrid();

    await user.dblClick(screen.getByText("Villa Rotonda"));
    const input = screen.getByDisplayValue("Villa Rotonda");
    await user.clear(input);
    await user.type(input, "Villa Norte");
    await user.tab();

    expect(screen.getByText("Villa Norte")).toBeInTheDocument();
  });
});

describe("cells that must never be edited", () => {
  it("does not open a read-only column", async () => {
    const user = userEvent.setup();
    const { onCellCommit } = renderGrid();

    await user.dblClick(screen.getByText("activo"));

    expect(onCellCommit).not.toHaveBeenCalled();
    expect(screen.queryByDisplayValue("activo")).not.toBeInTheDocument();
  });

  it("refuses to report an edit for a row with no id", async () => {
    const user = userEvent.setup();
    const { onCellCommit } = renderGrid({
      // A row an aggregate could produce: no id to address it by.
      rows: [{ name: "Sin identificador", amount: 0, status: "activo", notes: null }],
    });

    await user.dblClick(screen.getByText("Sin identificador"));
    const input = screen.getByDisplayValue("Sin identificador");
    await user.clear(input);
    await user.type(input, "Otro nombre");
    await user.tab();

    expect(onCellCommit).not.toHaveBeenCalled();
  });
});

describe("the grid itself", () => {
  it("has no trailing row for creating records", () => {
    renderGrid();

    // One record, one row number. A draft row would show a second one.
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.queryByText("2")).not.toBeInTheDocument();
  });

  it("shows the empty message instead of an empty frame", () => {
    renderGrid({ rows: [], emptyMessage: "Nada que mostrar" });

    expect(screen.getByText("Nada que mostrar")).toBeInTheDocument();
  });

  it("formats values for reading and hands the raw value to the editor", async () => {
    const user = userEvent.setup();
    renderGrid();

    // Currency reads as money…
    expect(screen.getByText("$140,926")).toBeInTheDocument();

    // …and edits as a plain number.
    await user.dblClick(screen.getByText("$140,926"));
    expect(screen.getByDisplayValue("140926")).toBeInTheDocument();
  });
});
