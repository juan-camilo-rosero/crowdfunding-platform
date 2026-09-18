import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { es } from "@/i18n";
import type { TableColumn, TableRow } from "@/lib/table/types";
import { SUBTITLE_SEPARATOR } from "@/lib/table/subtitle";
import { EditableDataTable } from "./EditableDataTable";

/**
 * Two-line cells in the EDITABLE grid: the record's name with its
 * distinguishing detail beneath, built from the record's other fields.
 */

const COLUMNS: TableColumn[] = [
  {
    key: "name",
    label: "Nombre",
    type: "text",
    subtitle: ["city", "type"],
  },
  { key: "city", label: "Ciudad", type: "select", options: ["Rotonda", "Otra"] },
  { key: "type", label: "Tipo", type: "select", options: ["casa", "lote"] },
  { key: "amount", label: "Monto", type: "currency" },
];

const ROWS: TableRow[] = [
  { id: "row-1", name: "Villa Rotonda", city: "Rotonda", type: "casa", amount: 1000 },
  { id: "row-2", name: "Lote 7", city: null, type: null, amount: 0 },
];

const detail = (...parts: string[]) => parts.join(SUBTITLE_SEPARATOR);

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

/** The pencil of the stacked name cell of a given record. */
const pencilFor = (name: string) =>
  screen.getByRole("button", {
    name: `${es.admin.editCell.replace("{campo}", "Nombre")}: ${name}`,
  });

describe("reading a two-line cell", () => {
  it("shows the name with the detail beneath it", () => {
    renderGrid();

    const name = screen.getByText("Villa Rotonda");
    const cell = name.parentElement!;
    expect(within(cell).getByText(detail("Rotonda", "casa"))).toBeInTheDocument();
  });

  it("stays on one line when the record has no detail yet", () => {
    renderGrid();

    const stack = screen.getByText("Lote 7").parentElement!;
    // Just the name: no empty second line hanging under it.
    expect(stack.children).toHaveLength(1);
  });

  it("marks a missing name with a dash rather than a blank first line", () => {
    renderGrid({
      rows: [{ id: "row-3", name: "", city: "Otra", type: "lote", amount: 0 }],
    });

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText(detail("Otra", "lote"))).toBeInTheDocument();
    // And the pencil says the value is empty, not "—".
    expect(
      screen.getByRole("button", {
        name: `${es.admin.editCell.replace("{campo}", "Nombre")}: ${es.admin.emptyValue}`,
      })
    ).toBeInTheDocument();
  });

  it("gives EVERY row the taller height, not only the ones with detail", () => {
    renderGrid();

    const rows = [screen.getByText("Villa Rotonda"), screen.getByText("Lote 7")].map(
      (node) => node.closest("div.flex.border-b")!
    );
    for (const row of rows) expect(row.className).toContain("h-14");
  });

  it("keeps the compact height in a table with no two-line column", () => {
    renderGrid({
      columns: COLUMNS.map(({ subtitle: _subtitle, ...column }) => column),
    });

    const row = screen.getByText("Villa Rotonda").closest("div.flex.border-b")!;
    expect(row.className).toContain("h-10.25");
  });

  it("never repeats the value itself when a column lists itself", () => {
    renderGrid({
      columns: [
        { key: "name", label: "Nombre", type: "text", subtitle: ["name", "city"] },
        { key: "city", label: "Ciudad", type: "text" },
      ],
      rows: [{ id: "row-1", name: "Villa Rotonda", city: "Rotonda" }],
    });

    expect(screen.getAllByText("Villa Rotonda")).toHaveLength(1);
    // "Rotonda" is both the subtitle and the city cell.
    expect(screen.getAllByText("Rotonda")).toHaveLength(2);
  });

  it("reads a field the table does not show", () => {
    // The sales funnel: the email is under the name, but has no column.
    renderGrid({
      columns: [
        { key: "full_name", label: "Nombre", type: "text", subtitle: ["email"] },
      ],
      rows: [{ id: "i-1", full_name: "Ana Pérez", email: "ana@ejemplo.com" }],
    });

    expect(screen.getByText("ana@ejemplo.com")).toBeInTheDocument();
  });
});

describe("editing a two-line cell", () => {
  it("edits the first line and keeps the detail in view while typing", async () => {
    const user = userEvent.setup();
    renderGrid();

    await user.click(pencilFor("Villa Rotonda"));

    const input = screen.getByDisplayValue("Villa Rotonda");
    expect(input).toHaveFocus();
    // Still there: the admin can see which record this is mid-edit.
    expect(screen.getByText(detail("Rotonda", "casa"))).toBeInTheDocument();
  });

  it("names the field for assistive tech, since it no longer fills the cell", async () => {
    const user = userEvent.setup();
    renderGrid();

    await user.click(pencilFor("Villa Rotonda"));

    expect(screen.getByRole("textbox", { name: "Nombre" })).toBeInTheDocument();
  });

  it("commits the new name like any other cell", async () => {
    const user = userEvent.setup();
    const { onCellCommit } = renderGrid();

    await user.dblClick(screen.getByText("Villa Rotonda"));
    const input = screen.getByDisplayValue("Villa Rotonda");
    await user.clear(input);
    await user.type(input, "Villa Norte{Enter}");

    expect(onCellCommit).toHaveBeenCalledWith("row-1", "name", "Villa Norte");
    expect(screen.getByText("Villa Norte")).toBeInTheDocument();
    // The detail is untouched by an edit to the name.
    expect(screen.getByText(detail("Rotonda", "casa"))).toBeInTheDocument();
  });

  it("opens with a double click on the DETAIL line too", async () => {
    const user = userEvent.setup();
    renderGrid();

    await user.dblClick(screen.getByText(detail("Rotonda", "casa")));

    expect(screen.getByDisplayValue("Villa Rotonda")).toBeInTheDocument();
  });

  it("restores both lines on Escape", async () => {
    const user = userEvent.setup();
    const { onCellCommit } = renderGrid();

    await user.click(pencilFor("Villa Rotonda"));
    await user.type(screen.getByDisplayValue("Villa Rotonda"), "XYZ{Escape}");

    expect(onCellCommit).not.toHaveBeenCalled();
    expect(screen.getByText("Villa Rotonda")).toBeInTheDocument();
    expect(screen.getByText(detail("Rotonda", "casa"))).toBeInTheDocument();
  });

  it("can fill in a name that was empty", async () => {
    const user = userEvent.setup();
    const { onCellCommit } = renderGrid({
      rows: [{ id: "row-3", name: null, city: "Otra", type: null, amount: 0 }],
    });

    // By its pencil: the empty "Tipo" select shows a dash of its own.
    await user.click(
      screen.getByRole("button", {
        name: `${es.admin.editCell.replace("{campo}", "Nombre")}: ${es.admin.emptyValue}`,
      })
    );
    // The editor starts empty — never with the dash as text.
    const input = screen.getByRole("textbox", { name: "Nombre" });
    expect(input).toHaveValue("");
    await user.type(input, "Casa Otra{Enter}");

    expect(onCellCommit).toHaveBeenCalledWith("row-3", "name", "Casa Otra");
  });
});

describe("the detail follows edits to its own fields", () => {
  it("updates the line under the name as soon as the city changes", async () => {
    const user = userEvent.setup();
    const { onCellCommit } = renderGrid();

    // The city of the first record, through its own select cell.
    await user.click(screen.getByRole("button", { name: "Rotonda" }));
    await user.click(await screen.findByRole("menuitem", { name: "Otra" }));

    expect(onCellCommit).toHaveBeenCalledWith("row-1", "city", "Otra");
    // Before any server answer: the grid reads what is on screen.
    expect(screen.getByText(detail("Otra", "casa"))).toBeInTheDocument();
    expect(screen.queryByText(detail("Rotonda", "casa"))).not.toBeInTheDocument();
  });

  it("grows a second line when a detail is filled in for the first time", async () => {
    const user = userEvent.setup();
    renderGrid({
      // Lote 7 alone, so its select cells are the only ones on screen.
      rows: [ROWS[1]],
    });

    // Empty select cells show a dash; the first one in the row is the city.
    const [cityCell] = screen
      .getAllByRole("button")
      .filter((button) => button.getAttribute("aria-haspopup") === "menu");
    await user.click(cityCell);
    await user.click(await screen.findByRole("menuitem", { name: "Rotonda" }));

    expect(screen.getByText("Rotonda", { selector: "span.text-sm" })).toBeInTheDocument();
  });
});
